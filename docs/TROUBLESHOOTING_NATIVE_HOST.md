# Native Messaging 连接问题排查

## 症状

扩展显示"已连接，服务未启动"——native messaging 通道看似建立但 HTTP 服务器未启动。

## 排查步骤

### 1. 检查扩展 ID 是否正确

扩展的 `manifest.json` 中有 `key` 字段（base64 编码的公钥），Chrome 据此计算扩展 ID。Native host 的 `allowed_origins` 必须与之匹配。

**计算扩展 ID 的算法：**

```js
const crypto = require('crypto');
const alphabet = 'abcdefghijklmnop';
const der = Buffer.from(key, 'base64');
const hash = crypto.createHash('sha256').update(der).digest();
const bytes = hash.slice(0, 16);
let id = '';
for (let i = 0; i < 16; i++) {
  id += alphabet[bytes[i] >> 4]; // 高 4 位 => a-p
  id += alphabet[bytes[i] & 0x0f]; // 低 4 位 => a-p
}
console.log(id); // 32 字符
```

**需要同步修改的文件：**

| 文件                                        | 说明                                              |
| ------------------------------------------- | ------------------------------------------------- |
| `app/native-server/src/scripts/constant.ts` | `EXTENSION_ID` 常量                               |
| Native Messaging Manifest                   | 运行 `node dist/cli.js register --force` 自动更新 |

Manifest 位置：`C:\Users\<user>\AppData\Roaming\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json`

### 2. 检查是否有旧版全局安装冲突

```bash
npm ls -g mcp-chrome-bridge
```

如果存在旧版（如 `1.0.31`），它可能注册了旧的 manifest 或生成残留的 `node_path.txt`，导致 Chrome 启动错误的 native host。

```bash
npm uninstall -g mcp-chrome-bridge
```

### 3. 重新构建并注册本地版本

```bash
cd app/native-server
npm run build
node dist/cli.js register --force
```

### 4. 清理残留进程

```bash
# 杀掉所有 native host 进程
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'index\\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# 确认端口 12306 无人占用
netstat -ano | findstr :12306
```

### 5. 重启 Chrome 并重试

1. 完全退出 Chrome（任务栏右键退出）
2. 重新打开 Chrome
3. `chrome://extensions` → 移除旧扩展 → 重新加载 `app/chrome-extension/.output/chrome-mv3`
4. 点击扩展图标 → 连接

### 6. 检查日志

Native host 的日志文件位于：

```
%LOCALAPPDATA%\mcp-chrome-bridge\logs\
```

- `native_host_wrapper_windows_*.log` — 启动日志（含 SCRIPT_DIR、NODE_SCRIPT 等）
- `native_host_stderr_windows_*.log` — 错误输出

如果日志中 `SCRIPT_DIR` 指向全局 npm 路径而非本地构建路径，则说明 Chrome 启动的是旧版 native host。

## 常见问题

| 问题                         | 原因                                           | 解决                                            |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| "已连接"但"服务未启动"       | 扩展 ID 不匹配，`connectNative` 被 Chrome 拒绝 | 重新计算 ID 并注册                              |
| SCRIPT_DIR 指向全局 npm 路径 | 旧版全局安装的 manifest 优先级更高             | `npm uninstall -g mcp-chrome-bridge` 后重新注册 |
| 端口 12306 被占用            | `start-server.js` 或其他进程占用了端口         | 杀掉占用进程                                    |
| 扩展反复断连                 | 扩展缓存了旧的 native port 状态                | 重启 Chrome，重新加载扩展                       |
