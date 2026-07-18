# Chrome MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)

> **让 AI 直接操控你的 Chrome 浏览器** — 一个基于 Model Context Protocol (MCP) 的服务器，向 AI 助手开放浏览器能力，实现浏览器自动化、内容分析和数据提取。

**📖 Language**: [中文](README.md) | [English](README_en.md)

---

## 概述

Chrome MCP Server 是一个基于 Chrome 扩展的 **MCP 服务器**。它向 AI 助手提供 **40 多个工具**，使其能够直接操控浏览器——导航页面、提取数据、截取屏幕、监控网络、管理书签等。

与基于 Playwright 的 MCP 服务不同，本扩展直接在您**正在使用的 Chrome 浏览器**上运行，保留所有登录态、Cookie、扩展和用户偏好。无需启动独立浏览器进程，无需重新登录。

## 核心特性

- **🤖 AI 原生浏览器控制** — 让任何兼容 MCP 的客户端（Claude、Cursor、VS Code 扩展等）操控您的浏览器
- **🔐 零配置，复用现有浏览器** — 直接使用您的 Chrome，所有登录态、书签和设置即刻可用
- **🛡️ 纯本地运行** — 所有处理都在本地完成，数据不会离开您的环境
- **🚄 Streamable HTTP 传输** — 现代 MCP 传输协议，支持实时流式响应
- **🧠 语义搜索** — 内置向量数据库和本地嵌入模型，支持跨标签页内容发现
- **📊 40+ 工具** — 全面的浏览器 API 覆盖：导航、截图、网络捕获、内容分析、表单交互、书签/历史管理、结构化数据提取
- **⚡ SIMD 加速** — 自定义 WebAssembly SIMD 优化，向量运算速度提升 4-8 倍
- **🔄 跨标签页上下文** — 无缝操作多个标签页和窗口

## 与 Playwright 方案对比

| 对比维度       | 基于 Playwright 的 MCP                                     | 基于 Chrome 扩展的 MCP（本项目）                         |
| -------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| **浏览器进程** | 需启动独立浏览器实例；需安装 Playwright + 下载浏览器二进制 | 直接使用用户现有的 Chrome                                |
| **登录态**     | 每个站点需要重新登录                                       | 自动继承已有登录态                                       |
| **用户环境**   | 干净配置文件——无扩展、无设置                               | 完整用户配置——扩展、Cookie、偏好全部保留                 |
| **API 能力**   | 受限于 Playwright API                                      | 完整的 Chrome 扩展 API（标签页、书签、历史记录、下载等） |
| **启动速度**   | 需启动并初始化新浏览器                                     | 扩展即刻激活                                             |
| **通信延迟**   | 50–200ms（浏览器协议）                                     | 更低延迟（进程内通信）                                   |

## 快速开始

### 环境要求

- Node.js >= 20.0.0（本仓库使用 Corepack 固定 pnpm 11.14.0）
- Chrome 或 Chromium 浏览器

### 安装步骤

#### 1. 安装 Chrome 扩展

从 [Releases 页面](https://github.com/phoenixlucky/mcp-chrome-2026/releases) 下载最新的 `chrome-mcp-server-*.zip`。

在 Chrome 中加载：

1. 打开 `chrome://extensions/`
2. 开启右上角的**开发者模式**
3. 将下载的 `.zip` 文件拖入页面即可安装
4. 扩展图标显示在工具栏中

#### 2. 安装 Native Host

```bash
# npm（安装后自动注册 Native Messaging Host）
npm install -g @ethanwilkins/mcp-chrome-bridge-2026

# pnpm
pnpm install -g @ethanwilkins/mcp-chrome-bridge-2026
```

安装后 `postinstall` 脚本会自动注册 Native Messaging Host。如果注册未成功，可手动运行：

```bash
mcp-chrome-bridge register
```

#### 3. 启动服务

```bash
# 一键启动（推荐）
mcp-chrome-bridge start

# 或克隆仓库后通过脚本启动
start-server.bat
```

Native Host 会监听 Chrome 扩展的连接，并在 `http://127.0.0.1:12306/mcp` 上启动 MCP HTTP 服务。

### 配置 MCP 客户端

#### Streamable HTTP（推荐）

```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

#### STDIO（备选）

```json
{
  "mcpServers": {
    "chrome-mcp-stdio": {
      "command": "node",
      "args": ["/path/to/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js"]
    }
  }
}
```

## 更新日志

### v1.4.0（2026-07-18）

- **萌萌猫娘助手** — Claude 与 Codex 助手统一使用温柔、专业的猫娘人格，同时保持工具执行可靠
- **Node 24 SQLite 兼容** — 升级 `better-sqlite3`，解决原生数据库模块在 Node 24 下无法加载的问题
- **DeepSeek API** — 智能助手新增 DeepSeek 流式对话引擎；设置 `DEEPSEEK_API_KEY` 后，在 CLI 下拉列表选择 DeepSeek

### v1.3.3（2026-07-17）

- **CDP 图片拦截** — 新增 `chrome_block_images`，在导航或刷新前阻止后续图片 HTTP 请求
- **操作叠层安全加固** — 参数严格校验（selector/coordinates 类型检查），渲染异常不再导致工具调用失败
- **辅助脚本改进** — web-fetcher-helper 和 base-browser 工具优化
- **滚动状态查询** — 新增 `chrome_get_scroll_state`，获取页面/容器原生滚动位置、最大滚动距离、是否到达顶部/底部
- **`chrome_javascript` 新参数 `requireResult`** — 要求脚本必须有返回值，避免无返回脚本误判为成功
- **McpToolsPage 组件** — Popup 新增工具搜索页面

### v1.3.2（2026-07-17）

- **卸载策略错误修复** — 内容脚本不再注册 `unload` 事件，避免 Permissions Policy 报错
- **构建锁定提醒** — 启动脚本在原生端构建前提示 Chrome 可能占用 `dist` 目录
- **操作明细叠层** — 显示操作目标、等待上限、选择范围以及可识别的展开/收起元素

### v1.3.1（2026-07-16）

- **操作状态叠层** — 页面左下角显示 MCP 当前操作，并高亮可定位的目标元素
- **懒加载滚动限时** — 每次缓慢滚动后返回，由调用方持续调用至底部，避免请求超时
- **后台操作开关** — Popup 弹窗新增"后台操作"开关，控制自动化操作是否抢占前台
- **CDP session 自动恢复** — 监听调试器断开事件，发送命令失败时自动重新连接
- **executeScript 空闲重试** — 脚本执行无结果时等待 100ms 后重试，提升首次执行成功率
- **默认后台打开** — navigate、console、injectScript、webFetcher 等工具默认在后台打开页面

### v1.3.0（2026-07-16）

- **Native Host ID 自动同步** — 注册时从当前扩展构建清单计算 ID，避免扩展 ID 与白名单不一致
- **启动脚本更清晰** — 仅构建、注册、清理 12306 旧端口，并输出扩展 ID
- **新猫娘图标** — 浏览器工具栏和插件弹窗右上角使用同一图标

### v1.3.0（2026-07-16）

- **CLI `start` 命令** — 新增 `cli.js start` 直接启动 Native Host
- **扩展 ID 自动推导** — Native Messaging 注册时自动读取当前构建的扩展 ID
- **端口冲突自动处理** — 启动脚本自动清理 12306 端口旧进程
- **一键启动脚本升级** — 先执行 `pnpm install`，通过 `cli.js start` 启动；新增 npm 版 `start-server-npm.bat`
- **插件图标压缩** — 各尺寸图标大幅减小（128.png: 210KB → 33KB）
- **弹出界面美化** — 状态横幅、发光状态点、SVG 警告图标、端口前缀输入框、连接控件视觉分组
- **扩展信息展示** — Popup 显示运行时扩展 ID 和图标

### v1.2.1（2026-07-15）

- **工具取消支持** — `CANCEL_TOOL` 消息类型，支持中止正在执行的工具调用
- **稳定等待** — `chrome_wait` 新增 `stableForMs` 参数，条件持续满足 N 毫秒后才返回
- **URL 安全守卫** — 写操作工具（navigate、click、fill、scroll、click_and_wait）接受 `expectedUrl` 参数，URL 不匹配时拒绝执行
- **按标签页串行化** — 同一标签页的写操作按队列顺序执行
- **`/status` 端点增强** — 新增 MCP 会话追踪、NativeHost 连接状态、健康检查 probe
- **过期间会话回收** — 闲置超过 10 分钟的 MCP 会话自动清理
- **工具级动态超时** — 根据工具类型（读/写/导航/长任务）自动调整超时时间

### v1.2.0（2026-07-15）

- **一键启动脚本** — 新增 `start-server.bat`，整合构建、注册、启动三步
- **服务状态端点** — `/status` 报告服务、MCP 会话、Native Messaging 和扩展状态
- **增强稳定性** — 浏览器写操作按标签页串行化、MCP 取消转发、过期间会话回收、移除模块级单例
- **`chrome_wait` 改进** — 新增 `stableForMs` 参数，确保虚拟列表等场景下元素稳定后返回
- **文档全面升级** — README 专业重写、TOOLS_zh.md 补充完整抓取工具文档

### v1.1.2（2026-07-15）

- **`chrome_get_page_text`** — 基于 Readability 的文章提取（纯文本、HTML、标题、作者、站点元数据）
- **同源 iframe 支持** — `chrome_scroll`、`chrome_wait`、`chrome_extract` 增加 `frameSelector` 参数
- **表格提取** — `chrome_extract` 新增 `table` 字段类型，支持 `colspan`/`rowspan` 展开
- **`chrome_click_and_wait`** — 点击后等待条件满足，一步完成

### v1.1.1（2026-07-15）

- **Native Host 自动连接** — 自动启动和断线重连本地 MCP 服务
- **服务状态展示** — 分别显示 Native Host 和 HTTP 服务的运行状态

### v1.1.0（2026-07-15）

- 4 个新增采集工具：`chrome_get_tab_url`、`chrome_scroll`、`chrome_wait`、`chrome_extract`

### v0.0.5（2025-12-30）

- Claude Code / Codex 可视化编辑器，详见 [VisualEditor](docs/VisualEditor_zh.md)

## 工具一览

| 分类           | 数量 | 说明                                                               |
| -------------- | ---- | ------------------------------------------------------------------ |
| **浏览器管理** | 7    | 窗口/标签页列表、导航、切换、关闭、前进后退、脚本注入              |
| **截图**       | 1    | 元素级、全页面、自定义视口截图                                     |
| **网络监控**   | 4    | 请求捕获（webRequest/Debugger API）、自定义 HTTP 请求              |
| **内容分析**   | 4    | 语义搜索、HTML/文本提取、交互元素检测、控制台输出捕获              |
| **交互操作**   | 3    | 点击、表单填充、键盘输入                                           |
| **数据管理**   | 4    | 历史记录搜索、书签增删查                                           |
| **采集提取**   | 6+   | 标签页 URL、滚动、等待、结构化提取、Readability 提取、点击等待组合 |

完整 API 参考：[中文](docs/TOOLS_zh.md) | [English](docs/TOOLS.md)

## 使用指南

- [智能助手指南](docs/SMART_ASSISTANT_zh.md) | [English](docs/SMART_ASSISTANT.md)：Claude、Codex、DeepSeek 会话与 API 配置。
- [快捷工具指南](docs/QUICK_TOOLS_zh.md) | [English](docs/QUICK_TOOLS.md)：页面 Quick Panel 和插件弹窗 MCP 工具目录。

## 使用示例

### AI 总结网页 + Excalidraw 可视化

**Prompt**: [excalidraw-prompt](prompt/excalidraw-prompt.md)  
**指令**: 总结当前页面内容，画图帮助理解。  
[演示视频](https://www.youtube.com/watch?v=3fBPdUBWVz0)

### AI 分析图片并用 Excalidraw 重建

**Prompt**: [excalidraw-prompt](prompt/excalidraw-prompt.md) | [content-analize](prompt/content-analize.md)  
**指令**: 分析图片内容，使用 Excalidraw 复现。  
[演示视频](https://www.youtube.com/watch?v=tEPdHZBzbZk)

### 样式注入与网页修改

**Prompt**: [modify-web-prompt](prompt/modify-web.md)  
**指令**: 修改当前页面样式，去除广告。  
[演示视频](https://youtu.be/twI6apRKHsk)

### 网络请求捕获与分析

**指令**: 找出搜索 API 端点，查看响应结构。  
[演示视频](https://youtu.be/1hHKr7XKqnQ)

### 浏览历史分析

**指令**: 分析近一个月的浏览记录。  
[演示视频](https://youtu.be/jf2UZfrR2Vk)

### 网页对话

**指令**: 翻译并总结当前网页。  
[演示视频](https://youtu.be/FlJKS9UQyC8)

### 页面与元素截图

**指令**: 截取 Hugging Face 首页 / 捕获特定图标元素。  
[演示视频：页面](https://youtu.be/7ycK6iksWi4) | [演示视频：元素](https://youtu.be/ev8VivANIrk)

### 书签管理

**指令**: 将当前页面添加到书签，放入合适的文件夹。  
[演示视频](https://youtu.be/R_83arKmFTo)

### 批量关闭标签页

**指令**: 关闭所有匹配关键词的标签页。  
[演示视频](https://youtu.be/2wzUT6eNVg4)

## 路线图

- [ ] 认证与权限管理
- [ ] 浏览器工作流录制与回放
- [ ] 可视化工作流自动化编辑器
- [ ] Firefox 扩展支持

## 贡献

欢迎贡献代码。提交 Pull Request 前请阅读 [CONTRIBUTING_zh.md](docs/CONTRIBUTING_zh.md)。

## 许可证

MIT — 详见 [LICENSE](LICENSE) 文件。

## 更多文档

- [架构设计](docs/ARCHITECTURE_zh.md)
- [工具 API 参考](docs/TOOLS_zh.md)
- [智能助手指南](docs/SMART_ASSISTANT_zh.md)
- [快捷工具指南](docs/QUICK_TOOLS_zh.md)
- [故障排除](docs/TROUBLESHOOTING_zh.md)
