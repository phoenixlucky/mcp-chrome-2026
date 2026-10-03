# Native Messaging Connection Troubleshooting

## Symptoms

The extension shows "connected, service not started" — the native messaging channel appears to be established, but the HTTP server did not start.

## Troubleshooting Steps

### 1. Check whether the extension ID is correct

The extension's `manifest.json` contains a `key` field (a base64-encoded public key), and Chrome computes the extension ID from it. The Native Host's `allowed_origins` must match it.

**Algorithm for computing the extension ID:**

```js
const crypto = require('crypto');
const alphabet = 'abcdefghijklmnop';
const der = Buffer.from(key, 'base64');
const hash = crypto.createHash('sha256').update(der).digest();
const bytes = hash.slice(0, 16);
let id = '';
for (let i = 0; i < 16; i++) {
  id += alphabet[bytes[i] >> 4]; // high 4 bits => a-p
  id += alphabet[bytes[i] & 0x0f]; // low 4 bits => a-p
}
console.log(id); // 32 characters
```

**Files that must be updated in sync:**

| File                                        | Description                                                        |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `app/native-server/src/scripts/constant.ts` | The `EXTENSION_ID` constant                                        |
| Native Messaging Manifest                   | Run `node dist/cli.js register --force` to update it automatically |

Manifest location: `C:\Users\<user>\AppData\Roaming\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json`

### 2. Check for conflicts with an older global installation

```bash
npm ls -g mcp-chrome-bridge
```

If an older version (such as `1.0.31`) is present, it may have registered an old manifest or left behind a stale `node_path.txt`, causing Chrome to launch the wrong native host.

```bash
npm uninstall -g mcp-chrome-bridge
```

### 3. Rebuild and register the local version

```bash
cd app/native-server
npm run build
node dist/cli.js register --force
```

### 4. Clean up leftover processes

```bash
# Kill all native host processes
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'index\\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Confirm that nothing is using port 12306
netstat -ano | findstr :12306
```

### 5. Restart Chrome and retry

1. Fully exit Chrome (right-click the taskbar icon and exit)
2. Open Chrome again
3. `chrome://extensions` → remove the old extension → reload `app/chrome-extension/.output/chrome-mv3`
4. Click the extension icon → connect

### 6. Check the logs

The Native Host log files are located in:

```
%LOCALAPPDATA%\mcp-chrome-bridge\logs\
```

- `native_host_wrapper_windows_*.log` — startup log (contains SCRIPT_DIR, NODE_SCRIPT, etc.)
- `native_host_stderr_windows_*.log` — error output

If `SCRIPT_DIR` in the log points to a global npm path instead of the local build path, Chrome is launching an old version of the native host.

## Common Problems

| Problem                                | Cause                                                       | Fix                                                       |
| -------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| "Connected" but "service not started"  | Extension ID mismatch, `connectNative` rejected by Chrome   | Recompute the ID and register                             |
| SCRIPT_DIR points to a global npm path | An older global installation's manifest has higher priority | `npm uninstall -g mcp-chrome-bridge`, then register again |
| Port 12306 is already in use           | `start-server.js` or another process is using the port      | Kill the process using it                                 |
| The extension keeps disconnecting      | The extension cached the old native port state              | Restart Chrome and reload the extension                   |
