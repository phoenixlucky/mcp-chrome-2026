# Windows Installation Guide 🔧

Detailed installation and configuration steps for Chrome MCP Server on Windows.

## 📋 Installation

1. **Download the latest Chrome extension from GitHub**

Download URL: https://github.com/phoenixlucky/mcp-chrome-2026/releases

2. **Install mcp-chrome-bridge globally**

Make sure Node.js is already installed; install it first if it is not.

> ⚠️ **Before installing**: First disconnect the browser MCP connection in the Chrome extension, then close apps that use the bridge, such as Codex, Reasonix, Claude, and Cursor, to avoid the `dist` directory being locked and triggering an `EBUSY` error.

```bash
npm install -g --allow-scripts=@ethanwilkins/mcp-chrome-bridge-2026 @ethanwilkins/mcp-chrome-bridge-2026
```

If `npm error code EBUSY` appears during installation and the message contains `rename ... mcp-chrome-bridge-2026\\dist`, the old version's `dist` directory is locked by Windows. Make sure the browser MCP connection is disconnected and apps that may use the bridge are closed, then run the following in an administrator PowerShell:

```powershell
npm uninstall -g @ethanwilkins/mcp-chrome-bridge-2026
npm cache verify
npm install -g --allow-scripts=@ethanwilkins/mcp-chrome-bridge-2026 @ethanwilkins/mcp-chrome-bridge-2026
```

If `npm uninstall` itself also fails with `EBUSY`, the old package is still locked by a process or security software, and `npm cache verify` cannot release this kind of file lock. Proceed in the following order:

1. Restart Windows; without opening Codex, Reasonix, Claude, Cursor, or similar apps first, run the install command again directly in an administrator PowerShell.
2. If it still fails, look for processes using the bridge:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and $_.CommandLine -match 'mcp-chrome-bridge|mcp-bridge|@ethanwilkins' } |
  Select-Object ProcessId, Name, CommandLine
```

Once you confirm that the processes are related to the bridge, stop them:

```powershell
Stop-Process -Id <pid> -Force
```

3. If no related process is found but the directory is still locked, first confirm the global directory npm currently uses, then rename the old package to keep it as a backup:

```powershell
$globalRoot = npm root -g
$packagePath = Join-Path $globalRoot '@ethanwilkins\mcp-chrome-bridge-2026'
Test-Path -LiteralPath $packagePath
Rename-Item -LiteralPath $packagePath -NewName 'mcp-chrome-bridge-2026.backup'
```

After the rename succeeds, run the install command again. Once the new version works, manually delete `mcp-chrome-bridge-2026.backup`; if the rename still fails, use Windows Resource Monitor or Process Explorer to search for `mcp-chrome-bridge-2026`, then find and close the programs locking the directory.

If NVM, Volta, or fnm is used on the machine, make sure the same Node.js environment is used to install and run the bridge:

```powershell
npm prefix -g
npm root -g
where.exe node
where.exe npm
```

3. **Load the Chrome extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select `your/dowloaded/extension/folder`
   - Click the extension icon to open the extension, then click Connect to see the MCP configuration
     <img width="475" alt="Screenshot 2025-06-09 15 52 06" src="https://github.com/user-attachments/assets/241e57b8-c55f-41a4-9188-0367293dc5bc" />

4. **Use with CherryStudio**

For the compatible type, select `streamableHttp`, and set the URL to `http://127.0.0.1:12306/mcp`.

The Windows desktop build `chrome-mcp-desktop-<version>-win-x64` provides all of the following entry points (where `<version>` is the product version):

- **Streamable HTTP (compatible)**: `http://127.0.0.1:12306/mcp`
- **Streamable HTTP (preview)**: `http://127.0.0.1:12306/mcp-new` (MCP 2026-07-28)
- **SSE (legacy MCP)**: `http://127.0.0.1:12306/sse`
- **SSE message address**: `http://127.0.0.1:12306/messages?sessionId=...`
- **STDIO**: use `mcp-chrome-stdio`, or the portable EXE with `--stdio`

<img width="675" alt="Screenshot 2025-06-11 15 00 29" src="https://github.com/user-attachments/assets/6631e9e4-57f9-477e-b708-6a285cc0d881" />

View the tool list; if tools are listed, you are ready to go

<img width="672" alt="Screenshot 2025-06-11 15 14 55" src="https://github.com/user-attachments/assets/d08b7e51-3466-4ab7-87fa-3f1d7be9d112" />

```json
{
  "mcpServers": {
    "streamable-mcp-server": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

## 🚀 Installation and Connection Problems

### Quick diagnosis

If you run into problems, run the diagnostic tool:

```bash
mcp-chrome-bridge doctor
```

Automatically fix common problems:

```bash
mcp-chrome-bridge doctor --fix
```

### If clicking the extension's connect button does not connect

1. **Check that mcp-chrome-bridge installed successfully** and is installed globally

```bash
mcp-chrome-bridge -V
```

<img width="612" alt="Screenshot 2025-06-11 15 09 57" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

2. **Check that the manifest file is in the correct directory**

Path: C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts

3. **Check the logs**

Logs are now stored in the user directory: `%LOCALAPPDATA%\mcp-chrome-bridge\logs\`

For example: `C:\Users\xxx\AppData\Local\mcp-chrome-bridge\logs\`

<img width="804" alt="Screenshot 2025-06-11 15 09 41" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

4. **Node.js path problems**

If you use a Node version manager (nvm-windows, volta, fnm), you can set an environment variable:

```cmd
set CHROME_MCP_NODE_PATH=C:\path\to\your\node.exe
```

Or run `mcp-chrome-bridge doctor --fix` to write the current Node path automatically.
