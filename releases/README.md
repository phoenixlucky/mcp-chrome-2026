# Chrome MCP Server — 发布包

此目录存放所有 Chrome 扩展的构建发布包（`.zip` 文件）。

## 规范

- **构建命令**: `cd app/chrome-extension && npm run zip`
- **wxt 构建输出**: `app/chrome-extension/.output/`（构建中间产物）
- **最终发布包**: 自动复制到 `releases/`（此目录）

每次运行 `npm run zip` 后，`postzip` 脚本会自动将 `.zip` 文件复制到此目录。

## 版本历史

| 文件                                 | 版本                        |
| ------------------------------------ | --------------------------- |
| `chrome-mcp-server-1.1.0-chrome.zip` | v1.1.0                      |
| `chrome-mcp-server-1.1.1-chrome.zip` | v1.1.1                      |
| `chrome-mcp-server-1.1.2-chrome.zip` | v1.1.2                      |
| `chrome-mcp-server-1.2.0-chrome.zip` | v1.2.0                      |
| `chrome-mcp-server-1.2.1-chrome.zip` | v1.2.1                      |
| `chrome-mcp-server-1.2.3-chrome.zip` | v1.2.3                      |
| `chrome-mcp-server-1.3.0-chrome.zip` | v1.3.0                      |
| `chrome-mcp-server-1.3.1-chrome.zip` | v1.3.1                      |
| `chrome-mcp-server-1.4.0-chrome.zip` | v1.4.0                      |
| `start-server-1.4.0.bat`             | v1.4.0 (pnpm 一键启动脚本)  |
| `start-server-npm-1.4.0.bat`         | v1.4.0 (npm 版一键启动脚本) |
