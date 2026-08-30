use serde::Serialize;
use serde_json::Value;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

const DEFAULT_PORT: u16 = 12306;
const ICON_BYTES: &[u8] = include_bytes!("../../../chrome-extension/public/icon/128.png");

struct BridgeState {
    child: Mutex<Option<Child>>,
    port: u16,
}

#[derive(Debug, Serialize)]
struct BridgeResponse {
    ok: bool,
    status: u16,
    data: Option<Value>,
    error: Option<String>,
}

fn configured_port() -> u16 {
    env::var("CHROME_MCP_PORT")
        .or_else(|_| env::var("MCP_HTTP_PORT"))
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .filter(|port| *port > 0)
        .unwrap_or(DEFAULT_PORT)
}

fn error_response(error: impl Into<String>) -> BridgeResponse {
    BridgeResponse {
        ok: false,
        status: 0,
        data: None,
        error: Some(error.into()),
    }
}

fn request_json(port: u16, method: &str, path: &str) -> BridgeResponse {
    let address = format!("127.0.0.1:{port}");
    let socket = match address.to_socket_addrs().ok().and_then(|mut addresses| addresses.next()) {
        Some(socket) => socket,
        None => return error_response("无法解析本机服务地址"),
    };
    let mut stream = match TcpStream::connect_timeout(&socket, Duration::from_secs(3)) {
        Ok(stream) => stream,
        Err(error) => return error_response(format!("本地服务未连接：{error}")),
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(4)));
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
    );
    if let Err(error) = stream.write_all(request.as_bytes()) {
        return error_response(format!("发送本地请求失败：{error}"));
    }

    let mut bytes = Vec::new();
    if let Err(error) = stream.read_to_end(&mut bytes) {
        return error_response(format!("读取本地响应失败：{error}"));
    }
    let response = String::from_utf8_lossy(&bytes);
    let Some((headers, body)) = response.split_once("\r\n\r\n") else {
        return error_response("本地服务返回了无效响应");
    };
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(0);
    let data = serde_json::from_str::<Value>(body.trim()).ok();
    let error = if status >= 400 {
        data.as_ref()
            .and_then(|value| value.get("message").or_else(|| value.get("error")))
            .and_then(Value::as_str)
            .map(str::to_owned)
            .or_else(|| Some(format!("本地服务返回 HTTP {status}")))
    } else {
        None
    };
    BridgeResponse {
        ok: (200..400).contains(&status),
        status,
        data,
        error,
    }
}

fn bridge_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(path) = env::var("CHROME_MCP_BRIDGE_EXECUTABLE") {
        candidates.push(PathBuf::from(path));
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("bridge/chrome-mcp-bridge.exe"));
        candidates.push(resource_dir.join("chrome-mcp-bridge.exe"));
    }
    if let Ok(executable) = env::current_exe() {
        if let Some(parent) = executable.parent() {
            candidates.push(parent.join("chrome-mcp-bridge.exe"));
            candidates.push(parent.join("resources/bridge/chrome-mcp-bridge.exe"));
        }
    }
    let development_releases = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../releases");
    if let Ok(entries) = fs::read_dir(development_releases) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.file_name().and_then(|name| name.to_str()).is_some_and(|name| {
                name.starts_with("chrome-mcp-bridge-") && name.ends_with(".exe")
            }) {
                candidates.push(path);
            }
        }
    }
    candidates
}

fn stop_owned_bridge(state: &BridgeState) {
    if let Ok(mut child) = state.child.lock() {
        if let Some(mut child) = child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn get_status(state: State<'_, BridgeState>) -> BridgeResponse {
    request_json(state.port, "GET", "/status")
}

#[tauri::command]
fn health_check(state: State<'_, BridgeState>) -> BridgeResponse {
    request_json(state.port, "GET", "/status?probe=1")
}

#[tauri::command]
fn control_service(action: String, state: State<'_, BridgeState>) -> BridgeResponse {
    let path = match action.as_str() {
        "start" => "/__chrome_mcp_bridge/start",
        "stop" => "/__chrome_mcp_bridge/stop",
        _ => return error_response("不支持的服务操作"),
    };
    request_json(state.port, "POST", path)
}

#[tauri::command]
fn start_bridge(app: AppHandle, state: State<'_, BridgeState>) -> Result<String, String> {
    if request_json(state.port, "GET", "/ping").ok {
        return Ok("attached".into());
    }

    if let Ok(mut child) = state.child.lock() {
        if let Some(existing) = child.as_mut() {
            if existing.try_wait().map_err(|error| error.to_string())?.is_none() {
                return Ok("starting".into());
            }
        }
        child.take();
    }

    let path = bridge_candidates(&app)
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            "找不到 chrome-mcp-bridge.exe。请把它放在客户端旁边，或设置 CHROME_MCP_BRIDGE_EXECUTABLE。".to_string()
        })?;
    let child_process = Command::new(&path)
        .arg("--tauri")
        .env("CHROME_MCP_STANDALONE", "1")
        .env("CHROME_MCP_PORT", state.port.to_string())
        .env("MCP_HTTP_PORT", state.port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("启动桥接服务失败：{error}"))?;
    *state.child.lock().map_err(|_| "无法锁定桥接进程状态".to_string())? = Some(child_process);
    Ok(path.display().to_string())
}

#[tauri::command]
fn open_log() -> Result<(), String> {
    let root = env::var("LOCALAPPDATA").map_err(|_| "找不到 LOCALAPPDATA".to_string())?;
    let path = PathBuf::from(root).join("mcp-chrome-bridge/logs/portable-launcher.log");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if !path.exists() {
        fs::write(&path, "").map_err(|error| error.to_string())?;
    }
    Command::new("notepad.exe")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("打开日志失败：{error}"))
}

pub fn run() {
    let state = BridgeState {
        child: Mutex::new(None),
        port: configured_port(),
    };
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![get_status, health_check, control_service, start_bridge, open_log])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示客户端", true, None::<&str>)?;
            let health = MenuItem::with_id(app, "health", "立即健康检查", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出客户端（停止服务）", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &health, &quit])?;
            let icon = tauri::image::Image::from_bytes(ICON_BYTES)?;
            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "health" => {
                        show_main_window(app);
                        let _ = app.emit("tray-health-check", ());
                    }
                    "quit" => {
                        let state = app.state::<BridgeState>();
                        let _ = request_json(state.port, "POST", "/__chrome_mcp_bridge/stop");
                        stop_owned_bridge(&state);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Chrome MCP Bridge desktop client");
}
