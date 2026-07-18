# Chrome MCP Server — 发布包

此目录存放所有 Chrome 扩展的构建发布包（`.zip` 文件）。

## 规范

- **构建命令**: `cd app/chrome-extension && npm run zip`
- **wxt 构建输出**: `app/chrome-extension/.output/`（构建中间产物）
- **最终发布包**: 自动复制到 `releases/`（此目录）

每次运行 `npm run zip` 后，`postzip` 脚本会自动将 `.zip` 文件复制到此目录。

## 版本历史

| 文件                                 | 版本                       |
| ------------------------------------ | -------------------------- |
| `chrome-mcp-server-1.1.0-chrome.zip` | v1.1.0                     |
| `chrome-mcp-server-1.1.1-chrome.zip` | v1.1.1                     |
| `chrome-mcp-server-1.1.2-chrome.zip` | v1.1.2                     |
| `chrome-mcp-server-1.2.0-chrome.zip` | v1.2.0                     |
| `chrome-mcp-server-1.2.1-chrome.zip` | v1.2.1                     |
| `chrome-mcp-server-1.2.3-chrome.zip` | v1.2.3                     |
| `chrome-mcp-server-1.3.0-chrome.zip` | v1.3.0                     |
| `chrome-mcp-server-1.3.1-chrome.zip` | v1.3.1                     |
| `chrome-mcp-server-1.4.0-chrome.zip` | v1.4.0                     |
| `start-server-1.4.0.bat`             | v1.4.0 (pnpm 一键启动脚本) |
| `start-server-npm-1.4.0.bat`         | v1.4.0 (npm 一键启动脚本)  |
| `chrome-mcp-server-1.5.0-chrome.zip` | v1.5.0                     |

### v1.5.0 变更说明

> **工作流引擎 v3 架构统一** — 旧版 record-replay v2 代码已全面迁移至 v3 统一架构。
>
> - 🧹 移除 v2 旧引擎、旧录制模块、旧节点系统（共 50+ 文件）
> - 🏗️ 动作处理器统一为 `record-replay-v3/actions` 模块
> - 🔌 插件系统重构为 `action-node-adapter` + `register-action-nodes`
> - 📦 新增 `public-api` / `builder-types` / `utils` 公共模块
> - 📉 净减少 ~12,300 行旧代码
