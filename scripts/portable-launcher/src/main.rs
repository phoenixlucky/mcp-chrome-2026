use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const FOOTER_MAGIC: &[u8; 8] = b"MCPBRDG1";
const HASH_LEN: usize = 64;
const FOOTER_LEN: usize = 8 + 8 + HASH_LEN;

#[derive(Debug, PartialEq, Eq)]
struct FooterInfo {
    bundle_offset: u64,
    bundle_len: u64,
    bundle_hash: String,
}

fn parse_bundle_footer(exe_file_len: u64, footer: &[u8]) -> Result<FooterInfo, String> {
    if footer.len() != FOOTER_LEN {
        return Err("portable launcher footer has an invalid length".into());
    }
    if &footer[..8] != FOOTER_MAGIC {
        return Err("portable launcher footer magic is invalid".into());
    }
    let bundle_len = u64::from_le_bytes(footer[8..16].try_into().unwrap());
    let hash_bytes = &footer[16..];
    if !hash_bytes.iter().all(u8::is_ascii_hexdigit) {
        return Err("portable launcher bundle hash is malformed".into());
    }
    let trailer_len = FOOTER_LEN as u64;
    let bundle_offset = exe_file_len
        .checked_sub(trailer_len)
        .and_then(|end| end.checked_sub(bundle_len))
        .ok_or_else(|| "portable launcher bundle length exceeds executable size".to_string())?;
    Ok(FooterInfo {
        bundle_offset,
        bundle_len,
        bundle_hash: String::from_utf8(hash_bytes.to_vec()).unwrap(),
    })
}

fn data_root() -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .or_else(|| env::var_os("TEMP"))
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
}

fn required_payload_paths(root: &Path) -> [PathBuf; 6] {
    [
        root.join("payload-config.json"),
        root.join("node.exe"),
        root.join("scripts/sea-launcher.cjs"),
        root.join("desktop-ui.ps1"),
        root.join("chrome-mcp-icon.ico"),
        root.join("app/native-server/dist/index.js"),
    ]
}

fn validate_payload(root: &Path) -> bool {
    required_payload_paths(root)
        .iter()
        .all(|path| path.is_file())
        && root
            .join("app/chrome-extension/.output/chrome-mv3/manifest.json")
            .is_file()
}

fn extract_payload(exe_path: &Path) -> Result<PathBuf, String> {
    let mut executable =
        File::open(exe_path).map_err(|error| format!("Unable to read the launcher: {error}"))?;
    let executable_len = executable
        .metadata()
        .map_err(|error| format!("Unable to read launcher metadata: {error}"))?
        .len();
    if executable_len < FOOTER_LEN as u64 {
        return Err("The launcher file is incomplete; runtime data is missing".into());
    }
    executable
        .seek(SeekFrom::End(-(FOOTER_LEN as i64)))
        .map_err(|error| format!("Unable to read the launcher footer: {error}"))?;
    let mut footer = vec![0; FOOTER_LEN];
    executable
        .read_exact(&mut footer)
        .map_err(|error| format!("Unable to read the launcher footer: {error}"))?;
    let info = parse_bundle_footer(executable_len, &footer)?;

    let cache_root = data_root().join("mcp-chrome-bridge/portable");
    let final_root = cache_root.join(format!("runtime-{}", info.bundle_hash));
    let marker = final_root.join(".complete");
    if marker.is_file() && validate_payload(&final_root) {
        return Ok(final_root);
    }
    fs::create_dir_all(&cache_root).map_err(|error| format!("Unable to create the runtime cache directory: {error}"))?;

    let unique = format!(
        "{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let temp_root = cache_root.join(format!("runtime-stage-{unique}"));
    let zip_path = cache_root.join(format!("bundle-{unique}.zip"));
    let result = (|| -> Result<(), String> {
        fs::create_dir_all(&temp_root).map_err(|error| format!("Unable to create the temporary extraction directory: {error}"))?;
        executable
            .seek(SeekFrom::Start(info.bundle_offset))
            .map_err(|error| format!("Unable to locate the embedded runtime: {error}"))?;
        let mut zip = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&zip_path)
            .map_err(|error| format!("Unable to create the temporary archive: {error}"))?;
        let mut limited = executable.take(info.bundle_len);
        io::copy(&mut limited, &mut zip).map_err(|error| format!("Unable to extract the embedded archive: {error}"))?;
        zip.flush()
            .map_err(|error| format!("Unable to write the embedded archive: {error}"))?;
        drop(zip);

        let tar_result = Command::new("tar.exe")
            .args(["-xf"])
            .arg(&zip_path)
            .arg("-C")
            .arg(&temp_root)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        if !matches!(tar_result, Ok(status) if status.success()) {
            let escaped_zip = zip_path.to_string_lossy().replace('\'', "''");
            let escaped_dest = temp_root.to_string_lossy().replace('\'', "''");
            let script = format!(
                "Expand-Archive -LiteralPath '{escaped_zip}' -DestinationPath '{escaped_dest}' -Force"
            );
            let status = Command::new("powershell.exe")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map_err(|error| format!("Neither tar.exe nor PowerShell could be started: {error}"))?;
            if !status.success() {
                return Err("Failed to extract the runtime; check the system tar.exe or PowerShell".into());
            }
        }
        if !validate_payload(&temp_root) {
            return Err("The runtime archive is missing required files; the EXE may be corrupted".into());
        }
        fs::write(temp_root.join(".complete"), &info.bundle_hash)
            .map_err(|error| format!("Unable to mark the runtime cache: {error}"))?;
        match fs::rename(&temp_root, &final_root) {
            Ok(()) => Ok(()),
            Err(_error) if marker.is_file() && validate_payload(&final_root) => Ok(()),
            Err(error) => Err(format!("Unable to publish the runtime cache: {error}")),
        }
    })();
    let _ = fs::remove_file(&zip_path);
    let _ = fs::remove_dir_all(&temp_root);
    result?;
    if !validate_payload(&final_root) {
        return Err("Runtime cache validation failed".into());
    }
    Ok(final_root)
}

fn launch() -> Result<i32, String> {
    let exe_path = env::current_exe().map_err(|error| format!("Unable to locate the launcher: {error}"))?;
    let payload_root = extract_payload(&exe_path)?;
    let args: Vec<_> = env::args_os().skip(1).collect();
    if args.len() == 1 && args[0] == "--verify-package" {
        let status = Command::new(payload_root.join("node.exe"))
            .arg(payload_root.join("scripts/sea-launcher.cjs"))
            .arg("--validate-payload")
            .current_dir(&payload_root)
            .env("CHROME_MCP_PAYLOAD_ROOT", &payload_root)
            .env("CHROME_MCP_LAUNCHER_PATH", &exe_path)
            .status()
            .map_err(|error| format!("Unable to verify the bundled Node runtime: {error}"))?;
        return Ok(status.code().unwrap_or(1));
    }
    let node = payload_root.join("node.exe");
    let script = payload_root.join("scripts/sea-launcher.cjs");
    let status = Command::new(node)
        .arg(script)
        .args(args)
        .current_dir(&payload_root)
        .env("CHROME_MCP_PAYLOAD_ROOT", &payload_root)
        .env("CHROME_MCP_LAUNCHER_PATH", &exe_path)
        .status()
        .map_err(|error| format!("Unable to start the bundled Node runtime: {error}"))?;
    Ok(status.code().unwrap_or(1))
}

fn show_error(message: &str) {
    let log_path = data_root().join("mcp-chrome-bridge/logs/portable-launcher.log");
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(file, "{}", message);
    }
    if env::args_os().len() <= 1 {
        #[cfg(windows)]
        unsafe {
            use std::os::windows::ffi::OsStrExt;
            #[link(name = "user32")]
            unsafe extern "system" {
                fn MessageBoxW(
                    hwnd: *mut std::ffi::c_void,
                    text: *const u16,
                    caption: *const u16,
                    kind: u32,
                ) -> i32;
            }
            let text: Vec<u16> =
                std::ffi::OsStr::new(&format!("{message}\n\nLog: {}", log_path.display()))
                    .encode_wide()
                    .chain(Some(0))
                    .collect();
            let title: Vec<u16> = std::ffi::OsStr::new("Chrome MCP Bridge failed to start")
                .encode_wide()
                .chain(Some(0))
                .collect();
            MessageBoxW(std::ptr::null_mut(), text.as_ptr(), title.as_ptr(), 0x10);
        }
    }
}

fn main() {
    match launch() {
        Ok(code) => std::process::exit(code),
        Err(error) => {
            show_error(&error);
            eprintln!("Chrome MCP Bridge failed to start: {error}");
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{FOOTER_LEN, FOOTER_MAGIC, parse_bundle_footer};

    fn fixture_footer(bundle_len: u64, digest: &str) -> Vec<u8> {
        let mut footer = Vec::from(FOOTER_MAGIC);
        footer.extend_from_slice(&bundle_len.to_le_bytes());
        footer.extend_from_slice(digest.as_bytes());
        footer
    }

    #[test]
    fn parses_bundle_offset_length_and_hash_from_exe_footer() {
        let digest = "ab".repeat(32);
        let footer = fixture_footer(1234, &digest);
        let parsed = parse_bundle_footer(5000, &footer).unwrap();
        assert_eq!(parsed.bundle_offset, 5000 - FOOTER_LEN as u64 - 1234);
        assert_eq!(parsed.bundle_len, 1234);
        assert_eq!(parsed.bundle_hash, digest);
    }

    #[test]
    fn rejects_footer_with_wrong_magic() {
        let mut footer = fixture_footer(10, &"01".repeat(32));
        footer[0] ^= 0xff;
        assert!(parse_bundle_footer(100, &footer).is_err());
    }

    #[test]
    fn rejects_truncated_bundle_and_malformed_hash() {
        let too_large = fixture_footer(100, &"01".repeat(32));
        assert!(parse_bundle_footer(100, &too_large).is_err());
        let malformed_hash = fixture_footer(10, &"gg".repeat(32));
        assert!(parse_bundle_footer(100, &malformed_hash).is_err());
    }
}
