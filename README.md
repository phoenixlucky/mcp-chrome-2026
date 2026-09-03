<p align="center">
  <img src="app/chrome-extension/public/icon/128.png" alt="Chrome MCP Server" width="96" height="96" />
</p>

<h1 align="center">Chrome MCP Server</h1>

<p align="center">
  <b>让 AI 直接操控你的 Chrome 浏览器</b><br />
  基于 Model Context Protocol，向 AI 助手开放 76 个浏览器能力
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8+-blue.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://developer.chrome.com/docs/extensions/"><img src="https://img.shields.io/badge/Chrome-Extension-green.svg?style=flat-square" alt="Chrome Extension" /></a>
  <a href="https://www.npmjs.com/package/@ethanwilkins/mcp-chrome-bridge-2026"><img src="https://img.shields.io/npm/v/@ethanwilkins/mcp-chrome-bridge-2026?style=flat-square" alt="npm" /></a>
  <a href="https://github.com/phoenixlucky/mcp-chrome-2026/releases"><img src="https://img.shields.io/github/v/release/phoenixlucky/mcp-chrome-2026?style=flat-square" alt="GitHub Release" /></a>
</p>

<p align="center">
  <b>
    <a href="README.md">🇨🇳 中文</a> ·
    <a href="README_en.md">🇬🇧 English</a>
  </b>
</p>

---

## 📢 v2.5.0 更新内容

> **MCP 2026-07-28 尝鲜版 + 多传输入口** — 新协议支持与更完整的连接方式。
>
> - 🆕 **Streamable HTTP（尝鲜版）** — 新增 `/mcp-new`，提供 MCP 2026-07-28 无会话传输，工具与权限策略与兼容版完全一致
> - 🔌 **多传输入口共存** — 兼容版 `/mcp`（保留会话）、旧 SSE `/sse` + `/messages`、STDIO 全部保留
> - 🖥️ **桌面版入口面板** — `chrome-mcp-desktop` 展示全部 MCP 服务入口与状态
> - 🔧 版本统一为 v2.5.0

> 查看 [完整更新日志](docs/CHANGELOG.md) 了解所有版本变更。

---

## 🖼️ 界面预览

<p align="center">
  <table style="border-collapse: collapse; width: 100%; max-width: 960px; margin: 0 auto;">
    <tr>
      <td align="center" style="padding: 8px 12px;"><b>Popup 弹窗</b></td>
      <td align="center" style="padding: 8px 12px;"><b>Builder 工作流编辑器</b></td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/popup-ui.webp" alt="Popup 弹窗" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/builder-ui.webp" alt="Builder 工作流编辑器" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">猫娘毛玻璃主题，<br/>MCP 工具一览</td>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">可视化拖拽搭建，<br/>录制回放工作流</td>
    </tr>
    <tr>
      <td align="center" style="padding: 8px 12px;"><b>Quick Panel 快捷操作</b></td>
      <td align="center" style="padding: 8px 12px;"><b>Smart Assistant 智能助手</b></td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/quick-panel.webp" alt="Quick Panel 快捷操作" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/assistant-ui.webp" alt="Smart Assistant 智能助手" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">页面内快捷工具，<br/>快速选取与操作</td>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">侧边栏对话，<br/>Claude / Codex / DeepSeek</td>
    </tr>
  </table>
</p>

## ✨ 核心特性

|                                                                     |                                                                    |                                                              |                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **🤖 AI 原生控制**<br/>Claude / Cursor / VS Code<br/>直接操控浏览器 | **🔐 零配置即用**<br/>复用现有 Chrome<br/>登录态 / Cookie 即刻继承 | **🛡️ 纯本地运行**<br/>数据不出环境<br/>隐私安全有保障        | **🚄 Streamable HTTP**<br/>实时流式响应<br/>现代 MCP 传输协议 |
| **🧠 语义搜索**<br/>向量数据库 + 本地嵌入<br/>跨标签页内容发现      | **⚡ SIMD 加速**<br/>WASM 优化引擎<br/>向量运算 4-8× 更快          | **📊 76 工具**<br/>导航 / 截图 / 表单<br/>书签 / 历史 / 网络 | **🔄 跨标签页操作**<br/>多标签 / 多窗口<br/>无缝协同管理      |

---

## ⚔️ 与 Playwright 对比

| 维度           | Playwright MCP              | Chrome 扩展 MCP（本项目）                    |
| -------------- | --------------------------- | -------------------------------------------- |
| **浏览器进程** | 需启动独立实例 + 下载二进制 | **直接使用你现有的 Chrome**                  |
| **登录态**     | 每个站点重新登录            | **自动继承**，即开即用                       |
| **用户环境**   | 干净配置文件，无扩展无设置  | **完整用户配置**，一切保留                   |
| **API 能力**   | 限于 Playwright API         | **完整 Chrome API**（标签页/书签/历史/下载） |
| **启动速度**   | 需初始化新浏览器（数秒）    | **即刻激活**（< 1s）                         |
| **通信延迟**   | 50–200ms                    | **更低延迟**，进程内通信                     |

---

## 🚀 5 分钟上手

### 1️⃣ 安装 Chrome 扩展

从 [Releases 页面](https://github.com/phoenixlucky/mcp-chrome-2026/releases) 下载 `chrome-mcp-server-*.zip`。

打开 `chrome://extensions/` → 开启 **开发者模式** → 拖入 `.zip` 安装。

### 2️⃣ 安装 Native Host

```bash
# npm（推荐，自动注册）
npm install -g --allow-scripts=@ethanwilkins/mcp-chrome-bridge-2026 @ethanwilkins/mcp-chrome-bridge-2026

# pnpm
pnpm install -g @ethanwilkins/mcp-chrome-bridge-2026
```

> `postinstall` 自动注册 Native Messaging Host。如需手动注册：`mcp-chrome-bridge register`

> 上面的 npm 命令会允许桥接器执行本次安装所需的脚本（`better-sqlite3` 自 v13 起自带 N-API 预编译二进制，不再需要执行安装脚本）。如果希望以后自动允许桥接器，可先执行：
>
> ```bash
> npm config set allow-scripts="@ethanwilkins/mcp-chrome-bridge-2026" --location=user
> ```

### 3️⃣ 启动服务

```bash
# 一键启动（推荐）
mcp-chrome-bridge start

# 或克隆仓库后用脚本
# Windows
start-server.bat

# macOS / Linux
bash start-server.sh
```

服务将在 `http://127.0.0.1:12306/mcp` 监听；同时保留 `mcp-new` 尝鲜版、旧 SSE 和 STDIO 入口。

### Windows 开发者：一键打包便携版 EXE

在仓库根目录双击 `package-windows.bat`。脚本会自动读取根 `package.json` 的版本并生成：

```text
releases/chrome-mcp-bridge-<版本>-win-x64.exe
```

主程序版本更新后无需修改 BAT；打包前会自动检查所有子包版本是否一致。

### 可选：保护 HTTP MCP 端点

默认保持本机免认证，便于直接使用。需要保护 HTTP / SSE 端点时，在启动服务前设置：

```powershell
$env:CHROME_MCP_API_KEY = "replace-with-a-long-random-key"
mcp-chrome-bridge start
```

客户端发送 `Authorization: Bearer <key>`（或 `x-api-key`）即可；STDIO 代理会读取同一个环境变量并自动转发 Bearer token。

### 工具并发和队列上限

为避免多个任务同时操作浏览器造成积压，服务端默认最多并行执行 8 个工具调用，最多排队 64 个。可按机器性能调整：

```powershell
$env:CHROME_MCP_MAX_CONCURRENT_TOOLS = "8"
$env:CHROME_MCP_MAX_QUEUED_TOOLS = "64"
mcp-chrome-bridge start
```

当前占用和排队数量可通过 `http://127.0.0.1:12306/status` 的 `toolAdmission` 查看。

### 工具权限范围与高风险审批

可用逗号分隔的工具名或简单前缀通配符（例如 `flow.*`）限制 MCP 客户端能发现和调用的工具：

```powershell
$env:CHROME_MCP_ALLOWED_TOOLS = "chrome_read_page,chrome_get_tab_url,flow.*"
$env:CHROME_MCP_REQUIRE_APPROVAL = "true"
$env:CHROME_MCP_APPROVED_TOOLS = "flow.checkout"
```

`CHROME_MCP_REQUIRE_APPROVAL=true` 时，`chrome_javascript`、`chrome_userscript`、写入/发布/文件上传、Profile 管理和 `flow.*` 等高风险工具必须同时出现在 `CHROME_MCP_APPROVED_TOOLS` 中；未通过范围或审批的工具不会出现在 `tools/list`，调用也会被拒绝。未配置这些变量时保持现有兼容行为。

没有 `Origin` 的 HTTP MCP 请求必须携带有效 API Key；带 Origin 的请求只接受本机或扩展 Origin。

### 4️⃣ 配置客户端

**Streamable HTTP（兼容版，推荐用于现有客户端）**

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

**Streamable HTTP（尝鲜版）**

新版 MCP 2026-07-28 无会话端点，地址为 `http://127.0.0.1:12306/mcp-new`：

```json
{
  "mcpServers": {
    "chrome-mcp-new": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp-new"
    }
  }
}
```

完整的请求头、`_meta` 结构和调试示例见 [`/mcp-new` 接口说明](docs/MCP_NEW_zh.md)。

**SSE（旧版 MCP）**

需要旧 SSE 协议的客户端继续使用：

- SSE 地址：`http://127.0.0.1:12306/sse`
- 消息地址：`http://127.0.0.1:12306/messages?sessionId=...`

**STDIO（无需额外桥接器）**

```json
{
  "mcpServers": {
    "chrome-mcp-stdio": {
      "command": "mcp-chrome-stdio",
      "env": {
        "MCP_SERVER_URL": "http://127.0.0.1:12306/mcp"
      }
    }
  }
}
```

`mcp-chrome-stdio` 内部使用 MCP SDK 的 Streamable HTTP 客户端，自动管理 HTTP POST、SSE 和 `sessionId` 生命周期；因此只支持 STDIO 的客户端也不需要另装 `mcp-bridge.js`。如果服务启用了 API Key，在同一段 `env` 中加入 `CHROME_MCP_API_KEY` 即可。

如果使用便携版 Windows EXE 作为 MCP 客户端的 `command`，请传入 `--stdio`：

```json
{
  "mcpServers": {
    "chrome-mcp-bridge": {
      "command": "D:\\path\\chrome-mcp-bridge-2.5.0-win-x64.exe",
      "args": ["--stdio"]
    }
  }
}
```

`--stdio` 会自动启动或复用本机的 MCP HTTP 服务。直接双击 EXE 会打开常驻的桌面管理器：窗口关闭会最小化到系统托盘，插件连接后管理器只显示状态，不会退出或与 Native Host 抢占 `12306`。不要把不带参数的 EXE 直接当作 stdio MCP 服务调用；需要 stdio 时请使用 `--stdio`。

桌面管理器提供服务状态、Chrome 扩展连接、Native Host 连接、MCP 会话数、工具数和健康检查。点击“停止服务”只暂停桥接服务并保留本机控制通道，点击“启动服务”即可恢复；托盘菜单中的“退出客户端（停止服务）”会停止服务并关闭管理器。若端口尚未监听，请先确认 Chrome 扩展已加载，扩展会自动启动 Native Host。

便携版排障可访问 `http://127.0.0.1:12306/status?probe=1`：`nativeHost.connected` 表示 Native Messaging 握手，`probe.ok` 表示桥接服务已经实际收到 Chrome 回包；仅 `/ping` 正常不能证明 Chrome 已接管。

---

## 🧩 隔离浏览器 Profile

默认情况下，所有浏览器工具继续直接操作你当前正在使用的 Chrome。需要账号、Cookie 或缓存隔离时，先调用 `chrome_profile`：

```json
{ "action": "create", "name": "工作账号", "profileId": "work" }
```

然后给普通浏览器工具增加 `profileId`；Profile 未启动时会自动拉起独立 Chrome：

```json
{ "profileId": "work", "url": "https://example.com" }
```

也可以用 `chrome_profile` 的 `list`、`status`、`diagnostics`、`launch`、`stop`、`delete` 管理 Profile。`delete` 只删除配置，不会自动删除 `userDataDir`，避免误删登录态；如需让独立 Chrome加载本地扩展，可设置 `CHROME_MCP_EXTENSION_PATH`。

点击、输入、滚动、导航等动作默认使用统一的 `balanced` 节奏；需要时可传 `actionPolicy: "fast"` 或 `actionPolicy: "human"`。

需要把多个浏览器动作组成一次任务时，可调用 `chrome_batch`，最多顺序执行 50 个工具调用；通过 `profileId` 可将整组任务固定到同一个隔离 Profile。现有工作流 v3 已支持持久化运行队列和 cron/interval 定时触发。

### 安全升级

```bash
mcp-chrome-bridge upgrade 2.3.0 --dry-run
mcp-chrome-bridge upgrade 2.3.0
```

升级只接受精确版本，会校验 npm SHA-512 完整性；安装后的关键文件校验失败会自动尝试回滚到原版本。

### ✅ 验证状态

- Native Server：5 个 Jest suite、18 个测试（含权限策略与 HTTP 鉴权）由 CI 执行并收集覆盖率
- Chrome Extension：58 个 Vitest 文件、567 个测试由 CI 执行
- Native / Extension / Shared TypeScript 检查通过
- 版本一致性：`pnpm check:versions`
- 工具文档：`pnpm check:tool-docs`

### 真实 Chrome Smoke Test

该测试不使用 jsdom、fake IndexedDB 或 mock Chrome API。请先安装并加载扩展、让 Native Host 连接成功并启动 HTTP 服务，再运行：

```powershell
pnpm test:chrome-smoke
```

测试会检查 Native Host 的扩展连接和浏览器探针，建立真实 MCP session，发现工具，并通过 `chrome_get_tab_url` 访问当前 Chrome 标签页。可用 `CHROME_MCP_SMOKE_URL`、`CHROME_MCP_SMOKE_TIMEOUT_MS` 和 `CHROME_MCP_API_KEY` 覆盖连接配置。

---

## 🛠️ 工具一览

| 分类              | 数量 | 覆盖能力                                                                        |
| ----------------- | :--: | ------------------------------------------------------------------------------- |
| 🖥️ **浏览器管理** |  12  | 窗口/标签页列表、新建标签页、导航、切换、关闭、当前 URL、滚动、Profile/批量任务 |
| 📷 **截图与 PDF** |  3   | 元素级、全页面、自定义视口、GIF 录制、页面打印为 PDF                            |
| 🌐 **网络监控**   |  6   | 指定标签抓包与响应等待、精确资源拦截、自定义 HTTP、下载处理                     |
| 📝 **内容分析**   |  7   | 语义搜索、HTML / 文本提取、交互元素检测、控制台日志、SPA 内容                   |
| 🖱️ **交互操作**   |  11  | 点击、悬停、表单填充、键盘输入、元素信息、计算机操作、对话框、上传              |
| 📑 **数据管理**   |  11  | 历史搜索、书签增删查、Cookie 管理、页面 local/sessionStorage、Userscript        |
| 📡 **采集提取**   |  16  | 作用域/Shadow DOM/iframe、受控分页、隔离任务状态、诊断快照、代理轮换            |
| ⚡ **性能诊断**   |  3   | Trace 录制 / 停止 / 洞察分析                                                    |

📖 完整 API 参考：[中文](docs/TOOLS_zh.md) · [English](docs/TOOLS.md)

---

## 📚 使用指南

| 指南                                          | 说明                                      |
| --------------------------------------------- | ----------------------------------------- |
| 🤖 [智能助手指南](docs/SMART_ASSISTANT_zh.md) | Claude / Codex / DeepSeek 会话与 API 配置 |
| ⚡ [快捷工具指南](docs/QUICK_TOOLS_zh.md)     | 页面 Quick Panel 和插件弹窗 MCP 工具目录  |

---

## 🎬 使用场景

| 场景                               | 操作                                    |
| ---------------------------------- | --------------------------------------- |
| 📄 **AI 总结 + Excalidraw 可视化** | 总结页面内容并画图                      |
| 🖼️ **图片分析 + Excalidraw 复现**  | 分析图片内容并重建                      |
| 🎨 **样式注入与网页修改**          | 修改页面样式去广告                      |
| 📡 **网络请求捕获分析**            | 查找 API 端点与响应结构                 |
| 📊 **浏览历史分析**                | 分析近一个月浏览记录                    |
| 💬 **网页对话**                    | 翻译并总结当前页面                      |
| 📸 **页面与元素截图**              | 截取首页 / 捕获图标                     |
| 🔖 **书签管理**                    | 将当前页添加到书签                      |
| 🗑️ **批量关闭标签页**              | 关闭匹配关键词的标签页                  |
| 🤖 **智能助手对话**                | 侧边栏与 Claude / Codex / DeepSeek 对话 |
| 🔄 **工作流录制与回放**            | 录制重复操作并一键回放                  |
| 🧩 **工作流可视化编排**            | Builder 拖拽搭建自动化流程              |
| 📊 **页面数据采集**                | 从列表 / 虚拟滚动页提取结构化数据       |
| ⚡ **页面性能分析**                | 录制 Trace 并分析加载瓶颈               |
| 🎥 **操作录制为 GIF**              | 将页面交互录制成 GIF                    |

---

## 🗺️ 路线图

### ✅ 已实现

- **76 MCP 工具** — 浏览器全能力覆盖，包含公开的 `chrome_userscript`
- **Streamable HTTP（兼容版 / 尝鲜版）+ SSE + STDIO 全部保留**
- **智能助手** — Claude / Codex / DeepSeek
- **语义搜索** — 向量数据库 + 本地嵌入
- **SIMD 加速** — WASM 引擎 4-8× 更快
- **工作流录制与回放** — v3 统一架构（旧架构已完全迁移）
- **可视化编辑器** — 拖拽搭建工作流
- **Native Messaging 自动注册**
- **跨平台安装体验** — macOS / Linux 一键脚本
- **多 Profile 任务隔离** — 独立 Cookie、缓存、历史与登录态
- **登录态持久化** — 关闭后可恢复独立 Profile
- **统一 ActionPolicy** — 稳定点击 / 输入 / 滚动节奏
- **多会话并行** — 多 Profile 使用独立 MCP/CDP 通道
- **Profile 诊断** — 汇总 Profile、CDP、MCP、代理与扩展状态
- **安全升级** — 精确版本、SHA-512 校验、失败回滚
- **批量与定时任务** — `chrome_batch`、工作流队列和 cron/interval 触发
- **Native Messaging 控制通道与并发治理** — 全局并发限制与全局队列限制（`CHROME_MCP_MAX_CONCURRENT_TOOLS=8` / `CHROME_MCP_MAX_QUEUED_TOOLS=64`）、同一 Tab 写操作串行、`chrome_batch` 不额外占用外层并发槽位、`/status` 的 `toolAdmission` 实时暴露占用与排队

### 🎯 规划中

- **认证与权限管理** — HTTP API Key、工具范围和高风险批准清单已支持；OAuth 仍在规划
- **实时监控仪表盘** — Web 面板查看调用、性能、错误
- **多版本 Chrome 实机矩阵** — 在不同 Chrome 版本 / Profile / 运行环境中做真实浏览器回归
- **产品边界扩展** — 托管浏览器与远程 CDP

#### 🧭 三层通道架构（规划中）

目标通道布局：Native Messaging 继续作为**安全控制通道**；大块二进制（截图、PDF、完整 HTML）不经过 Native Messaging，改走 Artifact 文件面；高频事件按需走 WebSocket。

```text
MCP Client
    │ stdio JSON-RPC
    ▼
mcp-chrome-bridge
    │ HTTP / MCP
    ▼
Native Service
    ├── 控制面：Native Messaging + JSON-RPC v2
    ├── 数据面：Artifact 文件 + localhost HTTP
    └── 事件面：localhost WebSocket（可选）
    ▼
Chrome Extension Background
    ├── chrome.tabs / scripting
    └── CDP
```

**核心原则**：Native Messaging 不传大块二进制；写操作不自动重试；同一 Tab 操作串行；所有请求具备超时、取消、追踪与最终状态；WebSocket、Go/Rust 重写只在性能数据证明需要时引入（Chrome Native Messaging 单条消息上限约 1 MB，不适合承载大截图、PDF 与完整 HTML）。

- **阶段一 · 协议 V2** — 统一 Native Service 与 Extension Background 协议：消息类型 `request` / `response` / `event` / `cancel` / `ping` / `pong` / `hello` / `capabilities`；协议版本协商、能力发现、JSON Schema 校验、requestId 去重、traceId 链路追踪、deadline 传播、AbortSignal 取消、统一错误码、单请求只响应一次。错误码：`INVALID_REQUEST` / `UNSUPPORTED_VERSION` / `DEADLINE_EXCEEDED` / `CANCELED` / `NATIVE_DISCONNECTED` / `QUEUE_FULL` / `BROWSER_ERROR` / `EXECUTION_UNKNOWN`
- **阶段二 · 连接与请求生命周期** — 统一状态机 `starting → connected → ready → degraded → stopped`；由一个重连管理器统一负责 Native Host 重连；断线时取消所有 active/pending 请求，HTTP 断开向下游传播取消；超时发送 cancel 而非仅返回错误；pending 请求最终必须进入完成 / 取消 / 失败。MV3 Service Worker 关键状态持久化到 `chrome.storage` / IndexedDB。副作用操作区分 `succeeded` / `failed-before-execution` / `execution-unknown`，断线后不自动重试
- **阶段三 · 并发、队列和隔离** — 在已完成机制之上继续：按浏览器实例 / Profile 隔离队列；读、写操作分离；写操作保持 Tab 内严格顺序；队列满返回 `QUEUE_FULL`；统计平均排队时长、拒绝次数、超时次数；读操作可选优先级但不打乱写顺序
- **阶段四 · Artifact 数据面** — 控制消息只返回元数据（`artifactId` / `contentType` / `size` / `sha256`）；小数据直接 JSON 返回，大文件分片传输（每片 256～512 KB，`artifactId + seq + eof + sha256`）；写入临时文件后原子改名；TTL 自动清理、容量上限、断线删除残留；对 Cookie / Token / Authorization 脱敏。第一版：Native Messaging 分片上传 + localhost HTTP 下载（改动最小）
- **阶段五 · localhost WebSocket 事件通道** — 仅当事件推送或高频数据成为瓶颈时启用；随机端口 + 一次性 Token 下发；适用于 Tab 状态变化、下载 / 长任务进度、网络事件、订阅与流式数据；只绑定 127.0.0.1、Origin 白名单、连接数 / 空闲 / 请求大小限制、禁止匿名访问敏感接口；Service Worker 中需周期性通信维持活跃
- **阶段六 · 安全和可观测性** — 精确校验扩展 ID、支持 `CHROME_MCP_ALLOWED_ORIGINS`、localhost 接口用 API Key / 一次性 Token、日志禁止输出 Cookie / Token / 完整页面、限制请求体与执行时间与 Artifact 容量、默认关闭调试接口；每请求 traceId 并记录 `stdio_wait` / `http_process` / `native_queue_wait` / `native_roundtrip` / `browser_execution` / `total` 分段耗时；`/status` 增加 `connectionState` / `pendingRequests` / `activeTools` / `queuedTools` / `reconnectCount` / `timeoutCount` / `cancelCount` / `queueRejectCount` / `lastError`；跨进程链路追踪（OpenTelemetry）暂缓
- **阶段七 · 统一传输实现** — 收敛 `mcp-bridge.js` 与 stdio 适配器公共逻辑（JSON-RPC 编解码、deadline、retry、错误映射、取消、Content-Length、`/mcp-new` 与 `/mcp` 兼容）；迁移顺序：Native Service 同时支持 V1/V2 → Extension Background 支持 V2 → Bridge 优先 V2 → `/mcp-new` 默认 → `/mcp` 仅兼容
- **阶段八 · 测试和发布** — 故障场景覆盖：Native Host 断线、响应丢失但操作成功、半包 / 粘包、Service Worker 休眠恢复、CDP 被 DevTools 占用、队列满取消、batch 达最大并发、Artifact 传输中断、重连连发请求、同一写操作重复请求、V1/V2 兼容。发布门槛：1000 次混合读写通过、30 分钟压测无内存持续增长、断线后 pending / controller / queue 归零、写操作无自动重放、单条 Native 输出低于安全阈值、大文件全走 Artifact、`/status` 准确、`/mcp` 兼容与 `/mcp-new` 主流程测试全过
- **最终技术选择与路线** — 推荐 Node.js/TypeScript：JSON-RPC V2 + TypeBox 校验 + AbortController + Artifact 文件存储 + localhost HTTP；WebSocket 仅用于高频事件与流式；暂不引入 WebTransport / gRPC / 直接 9222 CDP。路线：先统一协议 → 再完善取消与断线恢复 → 再拆分 Artifact 数据面 → 再按指标引入 WebSocket → 最后考虑 Go/Rust Native Host；优先完成协议 V2、生命周期管理、Artifact 与故障测试

### 🆕 新增工具

| 工具                                    | 说明                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `chrome_create_tab`                     | 新建标签页 — 支持 url、windowId、激活/后台打开、是否固定                      |
| `chrome_hover`                          | 悬停元素 — 通过 CSS/XPath 选择器触发 hover，展开 dropdown / tooltip / submenu |
| `chrome_print_to_pdf`                   | 打印为 PDF — 调用 CDP Page.printToPDF，支持页面/自定义纸张尺寸                |
| `chrome_get_element_info`               | 元素信息查询 — 获取指定元素的 attributes、computed styles、bounding rect      |
| `chrome_storage_get` / `set` / `delete` | 存储管理 — 读写 localStorage / sessionStorage                                 |

PDF 工具默认返回 PDF 的 Base64 数据；传入 `savePdf: true` 可同时保存到 Chrome 下载目录。页面存储工具操作目标标签页的 `localStorage` 或 `sessionStorage`，非扩展自身存储。

---

## 🤝 贡献

欢迎贡献！提交 PR 前请阅读 [CONTRIBUTING_zh.md](docs/CONTRIBUTING_zh.md)。

---

## 📄 许可证

MIT — 详见 [LICENSE](LICENSE) 文件。

---

## 📖 更多文档

| 文档                   | 链接                                                |
| ---------------------- | --------------------------------------------------- |
| 🏗️ 架构设计            | [ARCHITECTURE_zh.md](docs/ARCHITECTURE_zh.md)       |
| 🔧 工具 API 参考       | [TOOLS_zh.md](docs/TOOLS_zh.md)                     |
| 🤖 智能助手指南        | [SMART_ASSISTANT_zh.md](docs/SMART_ASSISTANT_zh.md) |
| ⚡ 快捷工具指南        | [QUICK_TOOLS_zh.md](docs/QUICK_TOOLS_zh.md)         |
| 🌐 `/mcp-new` 接口说明 | [MCP_NEW_zh.md](docs/MCP_NEW_zh.md)                 |
| 🔍 故障排除            | [TROUBLESHOOTING_zh.md](docs/TROUBLESHOOTING_zh.md) |
| 📋 更新日志            | [CHANGELOG.md](docs/CHANGELOG.md)                   |
