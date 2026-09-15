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
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
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
    let authorization = env::var("CHROME_MCP_API_KEY")
        .ok()
        .filter(|key| !key.trim().is_empty())
        .map(|key| format!("Authorization: Bearer {key}\r\n"))
        .unwrap_or_default();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nOrigin: http://127.0.0.1:1420\r\n{authorization}Connection: close\r\nContent-Length: 0\r\n\r\n"
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

fn tray_status(response: &BridgeResponse) -> (String, bool, bool, bool) {
    let Some(data) = response.data.as_ref() else {
        return ("状态：服务未连接".into(), true, false, false);
    };
    let running = data
        .get("server")
        .and_then(|server| server.get("serviceRunning"))
        .and_then(Value::as_bool);
    let connected = data
        .get("nativeHost")
        .and_then(|native| native.get("connected"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    match running {
        Some(false) => ("状态：服务已停止".into(), true, false, false),
        Some(true) if connected => ("状态：运行中 · Chrome 已连接".into(), false, true, true),
        Some(true) => ("状态：运行中 · 等待 Chrome".into(), false, true, true),
        None => ("状态：服务未连接".into(), true, false, false),
    }
}

fn refresh_tray_menu(
    port: u16,
    status: &MenuItem<tauri::Wry>,
    start: &MenuItem<tauri::Wry>,
    stop: &MenuItem<tauri::Wry>,
    restart: &MenuItem<tauri::Wry>,
) {
    let response = request_json(port, "GET", "/status");
    let (label, start_enabled, stop_enabled, restart_enabled) = if response.ok {
        tray_status(&response)
    } else {
        ("状态：服务未连接".into(), true, false, false)
    };
    let _ = status.set_text(label);
    let _ = start.set_enabled(start_enabled);
    let _ = stop.set_enabled(stop_enabled);
    let _ = restart.set_enabled(restart_enabled);
}

#[tauri::command]
fn get_status(state: State<'_, BridgeState>) -> BridgeResponse {
    request_json(state.port, "GET", "/status")
}

#[tauri::command]
fn get_error_diagnostics(state: State<'_, BridgeState>) -> BridgeResponse {
    request_json(state.port, "GET", "/__chrome_mcp_bridge/error-diagnostics")
}

#[tauri::command]
fn clear_error_diagnostics(terminal_id: String, state: State<'_, BridgeState>) -> BridgeResponse {
    if terminal_id != "all"
        && terminal_id != "default"
        && (terminal_id.is_empty()
            || !terminal_id
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_'))
    {
        return error_response("无效的错误日志终端 ID");
    }
    let path = if terminal_id == "all" {
        "/__chrome_mcp_bridge/error-diagnostics/clear".to_string()
    } else {
        format!("/__chrome_mcp_bridge/error-diagnostics/clear?terminalId={terminal_id}")
    };
    request_json(state.port, "POST", &path)
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
fn cancel_mcp_request(request_id: String, state: State<'_, BridgeState>) -> BridgeResponse {
    if request_id.is_empty()
        || !request_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return error_response("无效的 MCP 请求 ID");
    }
    request_json(
        state.port,
        "POST",
        &format!("/__chrome_mcp_bridge/requests/{request_id}/cancel"),
    )
}

#[tauri::command]
fn get_runtime(state: State<'_, BridgeState>) -> BridgeResponse {
    request_json(state.port, "GET", "/__chrome_mcp_bridge/runtime")
}

#[tauri::command]
fn control_runtime(task_id: String, action: String, state: State<'_, BridgeState>) -> BridgeResponse {
    if task_id.is_empty()
        || !task_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return error_response("无效的运行时任务 ID");
    }
    if !matches!(action.as_str(), "cancel" | "pause" | "resume" | "focus") {
        return error_response("不支持的运行时操作");
    }
    request_json(
        state.port,
        "POST",
        &format!("/__chrome_mcp_bridge/runtime/{task_id}/{action}"),
    )
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
        .invoke_handler(tauri::generate_handler![
            get_status,
            get_error_diagnostics,
            clear_error_diagnostics,
            health_check,
            control_service,
            cancel_mcp_request,
            get_runtime,
            control_runtime,
            start_bridge,
            open_log
        ])
        .setup(|app| {
            let status = MenuItem::with_id(app, "status", "状态：正在读取…", false, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "打开客户端", true, None::<&str>)?;
            let start = MenuItem::with_id(app, "start", "启动 MCP 服务", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "停止 MCP 服务", false, None::<&str>)?;
            let restart = MenuItem::with_id(app, "restart", "重启 MCP 服务", true, None::<&str>)?;
            let health = MenuItem::with_id(app, "health", "检查 Chrome 连接", true, None::<&str>)?;
            let log = MenuItem::with_id(app, "log", "打开运行日志", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出客户端并停止服务", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let separator_before_quit = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[
                    &status,
                    &separator,
                    &show,
                    &start,
                    &stop,
                    &restart,
                    &health,
                    &log,
                    &separator_before_quit,
                    &quit,
                ],
            )?;
            let icon = tauri::image::Image::from_bytes(ICON_BYTES)?;

            let menu_status = status.clone();
            let menu_start = start.clone();
            let menu_stop = stop.clone();
            let menu_restart = restart.clone();
            let tray_status_item = status.clone();
            let tray_start_item = start.clone();
            let tray_stop_item = stop.clone();
            let tray_restart_item = restart.clone();
            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "status" => {}
                    "show" => show_main_window(app),
                    "start" => {
                        let state = app.state::<BridgeState>();
                        let _ = request_json(state.port, "POST", "/__chrome_mcp_bridge/start");
                        refresh_tray_menu(
                            state.port,
                            &menu_status,
                            &menu_start,
                            &menu_stop,
                            &menu_restart,
                        );
                    }
                    "stop" => {
                        let state = app.state::<BridgeState>();
                        let _ = request_json(state.port, "POST", "/__chrome_mcp_bridge/stop");
                        refresh_tray_menu(
                            state.port,
                            &menu_status,
                            &menu_start,
                            &menu_stop,
                            &menu_restart,
                        );
                    }
                    "restart" => {
                        let state = app.state::<BridgeState>();
                        let _ = request_json(state.port, "POST", "/__chrome_mcp_bridge/stop");
                        let _ = request_json(state.port, "POST", "/__chrome_mcp_bridge/start");
                        refresh_tray_menu(
                            state.port,
                            &menu_status,
                            &menu_start,
                            &menu_stop,
                            &menu_restart,
                        );
                    }
                    "health" => {
                        show_main_window(app);
                        let _ = app.emit("tray-health-check", ());
                    }
                    "log" => {
                        let _ = open_log();
                    }
                    "quit" => {
                        let state = app.state::<BridgeState>();
                        let _ = request_json(state.port, "POST", "/__chrome_mcp_bridge/stop");
                        stop_owned_bridge(&state);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => show_main_window(tray.app_handle()),
                    TrayIconEvent::Click {
                        button: MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let state = tray.app_handle().state::<BridgeState>();
                        let port = state.port;
                        let status = tray_status_item.clone();
                        let start = tray_start_item.clone();
                        let stop = tray_stop_item.clone();
                        let restart = tray_restart_item.clone();
                        std::thread::spawn(move || {
                            refresh_tray_menu(port, &status, &start, &stop, &restart)
                        });
                    }
                    _ => {}
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
