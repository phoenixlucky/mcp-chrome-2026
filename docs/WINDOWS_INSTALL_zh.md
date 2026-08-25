# windows 安装指南 🔧

Chrome MCP Server 在windows电脑的详细安装和配置步骤

## 📋 安装

1. **从github上下载最新的chrome扩展**

下载地址：https://github.com/phoenixlucky/mcp-chrome-2026/releases

2. **全局安装mcp-chrome-bridge**

确保电脑上已经安装了node，如果没安装请自行先安装

> ⚠️ **安装前提醒**：请先在 Chrome 扩展中断开浏览器 MCP 连接，再关闭正在使用桥接程序的 Codex、Reasonix、Claude、Cursor 等应用，避免 `dist` 目录被占用而触发 `EBUSY` 错误。

```bash
npm install -g --allow-scripts=@ethanwilkins/mcp-chrome-bridge-2026 @ethanwilkins/mcp-chrome-bridge-2026
```

如果安装时出现 `npm error code EBUSY`，并且错误信息包含 `rename ... mcp-chrome-bridge-2026\\dist`，说明旧版本的 `dist` 目录正在被 Windows 占用。请确认已经断开浏览器 MCP 连接并关闭可能使用桥接程序的应用，然后在管理员 PowerShell 中执行：

```powershell
npm uninstall -g @ethanwilkins/mcp-chrome-bridge-2026
npm cache verify
npm install -g --allow-scripts=@ethanwilkins/mcp-chrome-bridge-2026 @ethanwilkins/mcp-chrome-bridge-2026
```

如果 `npm uninstall` 本身也出现 `EBUSY`，说明旧包仍被进程或安全软件占用，`npm cache verify` 无法解除这种文件锁。请按以下顺序处理：

1. 重启 Windows，不要先打开 Codex、Reasonix、Claude、Cursor 等应用，直接在管理员 PowerShell 中再次执行安装命令。
2. 如果仍然失败，查找正在使用桥接程序的进程：

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -and $_.CommandLine -match 'mcp-chrome-bridge|mcp-bridge|@ethanwilkins' } |
  Select-Object ProcessId, Name, CommandLine
```

确认是桥接程序相关进程后，再结束对应的进程：

```powershell
Stop-Process -Id <进程号> -Force
```

3. 如果没有找到相关进程但目录仍被锁定，先确认 npm 当前使用的全局目录，再将旧包改名保留为备份：

```powershell
$globalRoot = npm root -g
$packagePath = Join-Path $globalRoot '@ethanwilkins\mcp-chrome-bridge-2026'
Test-Path -LiteralPath $packagePath
Rename-Item -LiteralPath $packagePath -NewName 'mcp-chrome-bridge-2026.backup'
```

改名成功后重新执行安装命令。确认新版本运行正常后，再手动删除 `mcp-chrome-bridge-2026.backup`；如果改名仍失败，请使用 Windows“资源监视器”或 Process Explorer 搜索 `mcp-chrome-bridge-2026`，找到并关闭占用该目录的程序。

若电脑上使用了 NVM、Volta 或 fnm，请确认安装和运行桥接程序使用的是同一个 Node.js 环境：

```powershell
npm prefix -g
npm root -g
where.exe node
where.exe npm
```

3. **加载 Chrome 扩展**
   - 打开 Chrome 并访问 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"，选择 `your/dowloaded/extension/folder`
   - 点击插件图标打开插件，点击连接即可看到mcp的配置
     <img width="475" alt="截屏2025-06-09 15 52 06" src="https://github.com/user-attachments/assets/241e57b8-c55f-41a4-9188-0367293dc5bc" />

4. **在 CherryStudio 中使用**

类型选streamableHttp，url填http://127.0.0.1:12306/mcp

<img width="675" alt="截屏2025-06-11 15 00 29" src="https://github.com/user-attachments/assets/6631e9e4-57f9-477e-b708-6a285cc0d881" />

查看工具列表，如果能列出工具，说明已经可以使用了

<img width="672" alt="截屏2025-06-11 15 14 55" src="https://github.com/user-attachments/assets/d08b7e51-3466-4ab7-87fa-3f1d7be9d112" />

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

## 🚀 安装和连接问题

### 快速诊断

如果遇到问题，运行诊断工具：

```bash
mcp-chrome-bridge doctor
```

自动修复常见问题：

```bash
mcp-chrome-bridge doctor --fix
```

### 点击扩展的连接按钮后如果没连接成功

1. **检查mcp-chrome-bridge是否安装成功**，确保是全局安装的

```bash
mcp-chrome-bridge -V
```

<img width="612" alt="截屏2025-06-11 15 09 57" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

2. **检查清单文件是否已放在正确目录**

路径：C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts

3. **检查日志**

日志现在存储在用户目录：`%LOCALAPPDATA%\mcp-chrome-bridge\logs\`

例如：`C:\Users\xxx\AppData\Local\mcp-chrome-bridge\logs\`

<img width="804" alt="截屏2025-06-11 15 09 41" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

4. **Node.js 路径问题**

如果使用 Node 版本管理器（nvm-windows、volta、fnm），可以设置环境变量：

```cmd
set CHROME_MCP_NODE_PATH=C:\path\to\your\node.exe
```

或者运行 `mcp-chrome-bridge doctor --fix` 自动写入当前 Node 路径。
