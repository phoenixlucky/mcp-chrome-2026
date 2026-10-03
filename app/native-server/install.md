# Chrome MCP Bridge Installation Guide

This document describes in detail the installation and registration process of Chrome MCP Bridge.

## Installation flow overview

The installation and registration flow of Chrome MCP Bridge is as follows:

```
npm install -g mcp-chrome-bridge
└─ postinstall.js
   ├─ Copy executable to npm_prefix/bin   ← always writable (user or root permissions)
   ├─ Try user-level registration         ← no sudo needed, succeeds in most cases
   └─ If it fails ➜ prompt the user to run mcp-chrome-bridge register --system
      └─ Must be run manually with administrator permissions
```

The flow chart above shows the complete process from global installation to final registration.

## Detailed installation steps

### 1. Global installation

```bash
npm install -g mcp-chrome-bridge
```

After installation completes, the system automatically tries to register the Native Messaging host in the user directory. This does not require administrator permissions and is the recommended installation method.

### 2. User-level registration

User-level registration creates manifest files in the following locations:

```
Manifest file locations
├─ User level (no administrator permissions needed)
│  ├─ Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
│  ├─ macOS:   ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
│  └─ Linux:   ~/.config/google-chrome/NativeMessagingHosts/
│
└─ System level (administrator permissions needed)
   ├─ Windows: %ProgramFiles%\Google\Chrome\NativeMessagingHosts\
   ├─ macOS:   /Library/Google/Chrome/NativeMessagingHosts/
   └─ Linux:   /etc/opt/chrome/native-messaging-hosts/
```

If automatic registration fails, or if you want to register manually, run:

```bash
mcp-chrome-bridge register
```

**Recommended: run the diagnostics tool to check for problems:**

```bash
mcp-chrome-bridge doctor
```

### 3. System-level registration

If user-level registration fails (for example, due to permission problems), you can try system-level registration. System-level registration requires administrator permissions, but we provide two convenient ways to complete the process.

There are two ways to register at the system level:

#### Option 1: use the `--system` flag (recommended)

```bash
# macOS/Linux
sudo mcp-chrome-bridge register --system

# Windows (run the command prompt as administrator)
mcp-chrome-bridge register --system
```

System-level installation requires administrator permissions to write to system directories and the registry.

#### Option 2: use administrator permissions directly

**Windows**:
Run the command prompt or PowerShell as administrator, then execute:

```
mcp-chrome-bridge register
```

**macOS/Linux**:
Use the sudo command:

```
sudo mcp-chrome-bridge register
```

## Registration flow details

### Registration flow chart

```
Registration flow
├─ User-level registration (mcp-chrome-bridge register)
│  ├─ Get the user-level manifest path
│  ├─ Create the user directory
│  ├─ Generate the manifest content
│  ├─ Write the manifest file
│  └─ Windows platform: create the user-level registry entry
│
└─ System-level registration (mcp-chrome-bridge register --system)
   ├─ Check for administrator permissions
   │  ├─ Has permissions → create the system directory and write the manifest directly
   │  └─ No permissions → prompt the user to run with administrator permissions
   └─ Windows platform: create the system-level registry entry
```

### Manifest file structure

```
manifest.json
├─ name: "com.chromemcp.nativehost"
├─ description: "Node.js Host for Browser Bridge Extension"
├─ path: "/path/to/run_host.sh"       ← launcher script path
├─ type: "stdio"                      ← communication type
└─ allowed_origins: [                 ← extensions allowed to connect
   "chrome-extension://<extension-id>/"
]
```

### User-level registration flow

1. Determine the user-level manifest file path
2. Create the required directories
3. Generate the manifest content, including:
   - Host name
   - Description
   - Node.js executable path
   - Communication type (stdio)
   - Allowed extension ID
   - Launch arguments
4. Write the manifest file
5. On Windows, also create the corresponding registry entry

### System-level registration flow

1. Detect whether administrator permissions are already available
2. If administrator permissions are available:
   - Create the system-level directory directly
   - Write the manifest file
   - Set the appropriate permissions
   - Create the system-level registry entry on Windows
3. If administrator permissions are not available:
   - Prompt the user to rerun the command with administrator permissions
   - macOS/Linux: `sudo mcp-chrome-bridge register --system`
   - Windows: run the command prompt as administrator

## Verifying the installation

### Verification flow chart

```
Verify installation
├─ Check the manifest file
│  ├─ File exists → check whether the content is correct
│  └─ File missing → reinstall
│
├─ Check the Chrome extension
│  ├─ Extension installed → check extension permissions
│  └─ Extension not installed → install the extension
│
└─ Test the connection
   ├─ Connection succeeds → installation complete
   └─ Connection fails → check error logs → see troubleshooting
```

### Verification steps

After installation completes, you can verify the installation in the following ways:

1. Check whether the manifest file exists in the corresponding directory
   - User level: check the manifest file in the user directory
   - System level: check the manifest file in the system directory
   - Confirm that the manifest file content is correct

2. Install the corresponding extension in Chrome
   - Make sure the extension is installed correctly
   - Make sure the extension has the `nativeMessaging` permission

3. Try to connect to the local service through the extension
   - Use the extension's test feature to try connecting
   - Check the Chrome extension logs for error messages

## Troubleshooting

### Troubleshooting flow chart

```
Troubleshooting
├─ Permission problems
│  ├─ Check user permissions
│  │  ├─ Sufficient permissions → check directory permissions
│  │  └─ Insufficient permissions → try system-level installation
│  │
│  ├─ Execution permission problems (macOS/Linux)
│  │  ├─ "Permission denied" error
│  │  ├─ "Native host has exited" error
│  │  └─ Run mcp-chrome-bridge fix-permissions
│  │
│  └─ Try mcp-chrome-bridge register --system
│
├─ Path problems
│  ├─ Check the Node.js installation (node -v)
│  └─ Check the global NPM path (npm root -g)
│
├─ Registry problems (Windows)
│  ├─ Check registry access permissions
│  └─ Try creating the registry entry manually
│
└─ Other problems
   ├─ Check the console error messages
   └─ File an issue in the project repository
```

### Steps to resolve common problems

If you run into problems during installation, try the following steps:

1. Make sure Node.js is installed correctly
   - Run `node -v` and `npm -v` to check the versions
   - Make sure the Node.js version is >= 20.x

2. Check whether you have sufficient permissions to create files and directories
   - User-level installation needs write permissions to the user directory
   - System-level installation needs administrator/root permissions

3. **Fix execution permission problems**

   **macOS/Linux platform**:

   **Problem description**:
   - npm installation usually preserves file permissions, but pnpm may not
   - You may encounter "Permission denied" or "Native host has exited" errors
   - The Chrome extension cannot start the native host process

   **Solution**:

   a) **Use the built-in fix command (recommended)**:

   ```bash
   mcp-chrome-bridge fix-permissions
   ```

   b) **Run the diagnostics tool to fix automatically**:

   ```bash
   mcp-chrome-bridge doctor --fix
   ```

   c) **Set permissions manually**:

   ```bash
   # Find the installation path
   npm list -g mcp-chrome-bridge
   # Or for pnpm
   pnpm list -g mcp-chrome-bridge

   # Set execution permissions (replace with the actual path)
   chmod +x /path/to/node_modules/mcp-chrome-bridge/run_host.sh
   chmod +x /path/to/node_modules/mcp-chrome-bridge/index.js
   chmod +x /path/to/node_modules/mcp-chrome-bridge/cli.js
   ```

   **Windows platform**:

   **Problem description**:
   - On Windows, `.bat` files usually do not need execution permissions, but you may run into other problems
   - Files may be marked read-only
   - You may encounter "Access denied" or file-cannot-execute errors

   **Solution**:

   a) **Use the built-in fix command (recommended)**:

   ```cmd
   mcp-chrome-bridge fix-permissions
   ```

   b) **Run the diagnostics tool to fix automatically**:

   ```cmd
   mcp-chrome-bridge doctor --fix
   ```

   c) **Check the file attributes manually**:

   ```cmd
   # Find the installation path
   npm list -g mcp-chrome-bridge

   # Check the file attributes (right-click -> Properties in File Explorer)
   # Make sure run_host.bat is not a read-only file
   ```

   d) **Reinstall with forced permissions**:

   ```bash
   # Uninstall
   npm uninstall -g mcp-chrome-bridge
   # Or pnpm uninstall -g mcp-chrome-bridge

   # Reinstall
   npm install -g mcp-chrome-bridge
   # Or pnpm install -g mcp-chrome-bridge

   # If problems persist, run the permission fix
   mcp-chrome-bridge fix-permissions
   ```

4. On Windows, make sure registry access is not restricted
   - Check whether `HKCU\Software\Google\Chrome\NativeMessagingHosts\` is accessible
   - For the system level, check `HKLM\Software\Google\Chrome\NativeMessagingHosts\`

5. Try system-level installation
   - Use the `mcp-chrome-bridge register --system` command
   - Or run directly with administrator permissions

6. Check the error messages printed to the console
   - Detailed error messages usually point to the problem
   - You can add the `--verbose` flag for more log information

If the problem persists, file an issue in the project repository with the following information:

- Operating system version
- Node.js version
- Installation command
- Error message
- Solutions attempted
