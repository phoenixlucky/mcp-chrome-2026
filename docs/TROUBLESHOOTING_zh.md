# 🚀 安装和连接问题：常见问答

## 问：如何快速诊断安装或连接问题？

**答：**运行诊断工具检查 Native Messaging 清单、启动脚本、Node.js 路径和连接状态：

```bash
mcp-chrome-bridge doctor
```

如果诊断结果指出可自动修复的问题，可以运行：

```bash
mcp-chrome-bridge doctor --fix
```

`doctor --fix` 会尝试修复工具识别出的常见配置问题，例如写入当前 Node.js 路径。修复后重新连接扩展，再运行一次 `doctor`，确认问题已经消失。

## 问：如何导出诊断报告？报告里会包含什么信息？

**答：**提交 Issue 或请求帮助时，可以用以下命令生成报告：

```bash
# 在终端打印 Markdown 报告，方便复制到 GitHub Issue
mcp-chrome-bridge report

# 写入文件
mcp-chrome-bridge report --output mcp-report.md

# 复制到剪贴板
mcp-chrome-bridge report --copy
```

报告汇总排查所需的环境和诊断信息。默认会脱敏用户名、路径和令牌，减少分享敏感信息的风险；只有在确实需要提供完整路径且确认分享范围合适时，才使用 `--no-redact`。

## 问：本机状态端点 `/status` 为什么返回 403？

**答：**`/status` 也受本机接口的 Origin / API Key 校验保护。直接在浏览器地址栏打开 `http://127.0.0.1:12306/status` 时，浏览器通常不会发送 `Origin` 请求头；如果服务端没有配置 API Key，这种请求会被拒绝并返回 403。403 表示请求没有通过访问校验，不代表服务没有启动。

可以从 Chrome 扩展或桌面客户端查看状态；它们会按要求发起本机请求。也可以用命令行发送允许的本机 Origin：

```bash
curl -H "Origin: http://127.0.0.1:1420" http://127.0.0.1:12306/status
```

默认允许 `http://localhost` 和 `http://127.0.0.1` 来源。如果配置了 `CHROME_MCP_ALLOWED_ORIGINS`，Origin 必须与配置项完全一致。若服务启用了 `CHROME_MCP_API_KEY`，还需要发送 `Authorization: Bearer <密钥>`；此时仅有允许的 Origin 仍不够。

## 问：扩展显示连接成功，但服务启动失败，通常是什么原因？

**答：**常见原因是启动脚本没有执行权限，或脚本找不到 Node.js。先运行 `mcp-chrome-bridge doctor` 查看具体诊断结果，再按下面的问题检查全局安装、Native Messaging 清单、脚本权限和 Node.js 路径。扩展显示连接成功只说明扩展已尝试建立连接，不一定代表 Native Host 已成功启动。

## 问：如何确认 `mcp-chrome-bridge` 已正确安装？

**答：**确保软件包是全局安装的，然后运行：

```bash
mcp-chrome-bridge -V
```

如果命令能输出版本号，说明当前终端可以找到已安装的命令行程序。若提示找不到命令，通常是尚未全局安装，或全局 npm 可执行目录没有加入 `PATH`。

<img width="612" alt="命令行版本检查示例" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

## 问：Native Messaging 清单文件在哪里？

**答：**检查 Chrome 的 Native Messaging Hosts 目录中是否存在 `com.chromemcp.nativehost.json`：

- Windows：`C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts`
- macOS：`~/Library/Application Support/Google/Chrome/NativeMessagingHosts`

清单中的 `path` 字段应指向 Native Host 启动脚本，`allowed_origins` 应包含扩展的来源。示例：

```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension",
  "path": "/Users/xxx/Library/pnpm/global/5/.pnpm/mcp-chrome-bridge@1.0.23/node_modules/mcp-chrome-bridge/dist/run_host.sh",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"]
}
```

如果清单文件不存在，Chrome 就无法根据扩展请求找到并启动 Native Host。确认全局安装后，可以运行以下命令注册清单：

```bash
mcp-chrome-bridge register
```

## 问：启动失败时应该查看哪些日志？

**答：**包装器日志保存在当前用户可写的目录：

- macOS：`~/Library/Logs/mcp-chrome-bridge/`
- Windows：`%LOCALAPPDATA%\mcp-chrome-bridge\logs\`（例如 `C:\Users\xxx\AppData\Local\mcp-chrome-bridge\logs\`）
- Linux：`~/.local/state/mcp-chrome-bridge/logs/`

日志通常能帮助区分启动脚本权限错误、找不到 Node.js 和其他启动异常。如果诊断工具没有定位问题，请查看最新日志，并在提交 Issue 时附上脱敏后的诊断报告。

<img width="804" alt="日志目录示例" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

## 问：如何修复启动脚本没有执行权限的问题？

**答：**如果日志或诊断结果指出 `run_host.sh`（Windows 上为 `run_host.bat`）无法执行，可运行：

```bash
mcp-chrome-bridge fix-permissions
```

这个命令用于修复启动脚本的执行权限。完成后重新连接扩展；如果仍然启动失败，再检查 Node.js 路径和日志。

## 问：为什么启动脚本提示找不到 Node.js？如何指定 Node.js 路径？

**答：**Native Host 由 Chrome 启动时，使用的环境变量和交互式终端可能不同。使用 nvm、volta、asdf 或 fnm 等版本管理工具时，Node.js 可能只在终端的初始化脚本加载后才可用，因此 Native Host 找不到它。

可以设置 `CHROME_MCP_NODE_PATH`，让启动器使用明确的 Node.js 可执行文件路径：

```bash
export CHROME_MCP_NODE_PATH=/path/to/your/node
```

也可以在终端运行 `mcp-chrome-bridge doctor --fix`，让工具尝试写入当前 Node.js 路径。修改后重新启动服务并运行 `mcp-chrome-bridge doctor`，确认路径检查通过。

## 问：检查了安装、清单、权限和 Node.js 之后仍然启动失败，怎么办？

**答：**这说明问题可能不属于上述常见配置错误。查看用户日志目录中最新的包装器日志，并运行 `mcp-chrome-bridge report` 导出脱敏报告；提交 Issue 时附上错误日志和报告，便于进一步定位。

## 问：工具执行超时应该怎么办？

**答：**连接持续较长时间后，当前会话可能超时。先重新连接，再重试工具调用。如果反复在同一操作上超时，记录发生时间、操作和相关日志，并附在诊断报告中；这有助于判断是会话过期还是服务或浏览器响应缓慢。

## 问：为什么不同 Agent 或模型使用工具的效果不一样？

**答：**不同 Agent 和模型在理解任务、选择工具及组织步骤方面存在差异，因此同一工具的使用效果可能不同。可以尝试不同的 Agent 或模型，并在请求中明确目标、页面或标签页范围，以及预期结果；这样能减少歧义，也更容易判断差异来自模型还是连接问题。
