<p align="center">
  <img src="app/chrome-extension/public/icon/128.png" alt="Chrome MCP Server" width="96" height="96" />
</p>

<h1 align="center">Chrome MCP Server</h1>

<p align="center">
  <b>让 AI 直接操控你的 Chrome 浏览器</b><br />
  基于 Model Context Protocol，向 AI 助手开放 75 个浏览器能力
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

## 📢 v2.3.1 更新内容

> **7 个页面工具 + 欢迎页本地化** — 页面控制与扩展存储能力。
>
> - 🆕 **`chrome_create_tab`** — 新建标签页，支持 URL / 窗口 / 前台后台 / 固定
> - 🖱️ **`chrome_hover`** — 元素悬停，触发 hover 态交互
> - 📄 **`chrome_print_to_pdf`** — A3-A5 / LETTER / LEGAL / TABLOID 多种纸张导出 PDF
> - 🔍 **`chrome_get_element_info`** — 元素几何与属性检测
> - 💾 **`chrome_storage_get` / `set` / `delete`** — 扩展本地存储读写删
> - 🌐 **Welcome 页面中英文切换** — 语言自动检测 + 持久化
> - 🔧 版本统一为 v2.3.1

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
| **🧠 语义搜索**<br/>向量数据库 + 本地嵌入<br/>跨标签页内容发现      | **⚡ SIMD 加速**<br/>WASM 优化引擎<br/>向量运算 4-8× 更快          | **📊 75 工具**<br/>导航 / 截图 / 表单<br/>书签 / 历史 / 网络 | **🔄 跨标签页操作**<br/>多标签 / 多窗口<br/>无缝协同管理      |

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
npm install -g --allow-scripts=@ethanwilkins/mcp-chrome-bridge-2026,better-sqlite3 @ethanwilkins/mcp-chrome-bridge-2026

# pnpm
pnpm install -g @ethanwilkins/mcp-chrome-bridge-2026
```

> `postinstall` 自动注册 Native Messaging Host。如需手动注册：`mcp-chrome-bridge register`

> 上面的 npm 命令会允许桥接器和 `better-sqlite3` 执行本次安装所需的脚本。如果希望以后自动允许这两个包，可先执行：
>
> ```bash
> npm config set allow-scripts="@ethanwilkins/mcp-chrome-bridge-2026,better-sqlite3" --location=user
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

服务将在 `http://127.0.0.1:12306/mcp` 监听。

### 4️⃣ 配置客户端

**Streamable HTTP（推荐）**

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

**STDIO（备选）**

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

- Native Server：4 个测试套件、12 个测试通过
- Chrome Extension：57 个测试文件、563 个测试通过
- Native / Extension / Shared TypeScript 检查通过

---

## 🛠️ 工具一览

| 分类              | 数量 | 覆盖能力                                                                        |
| ----------------- | :--: | ------------------------------------------------------------------------------- |
| 🖥️ **浏览器管理** |  12  | 窗口/标签页列表、新建标签页、导航、切换、关闭、当前 URL、滚动、Profile/批量任务 |
| 📷 **截图与 PDF** |  3   | 元素级、全页面、自定义视口、GIF 录制、页面打印为 PDF                            |
| 🌐 **网络监控**   |  6   | 指定标签抓包与响应等待、精确资源拦截、自定义 HTTP、下载处理                     |
| 📝 **内容分析**   |  7   | 语义搜索、HTML / 文本提取、交互元素检测、控制台日志、SPA 内容                   |
| 🖱️ **交互操作**   |  11  | 点击、悬停、表单填充、键盘输入、元素信息、计算机操作、对话框、上传              |
| 📑 **数据管理**   |  10  | 历史搜索、书签增删查、Cookie 管理、页面 local/sessionStorage                    |
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

- **75 MCP 工具** — 浏览器全能力覆盖
- **Streamable HTTP + STDIO 双传输**
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

### 🎯 规划中

- **认证与权限管理** — API Key / OAuth 接入
- **实时监控仪表盘** — Web 面板查看调用、性能、错误
- **多版本 Chrome 实机矩阵** — 在不同 Chrome 版本 / Profile / 运行环境中做真实浏览器回归
- **产品边界扩展** — 托管浏览器与远程 CDP

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

| 文档             | 链接                                                |
| ---------------- | --------------------------------------------------- |
| 🏗️ 架构设计      | [ARCHITECTURE_zh.md](docs/ARCHITECTURE_zh.md)       |
| 🔧 工具 API 参考 | [TOOLS_zh.md](docs/TOOLS_zh.md)                     |
| 🤖 智能助手指南  | [SMART_ASSISTANT_zh.md](docs/SMART_ASSISTANT_zh.md) |
| ⚡ 快捷工具指南  | [QUICK_TOOLS_zh.md](docs/QUICK_TOOLS_zh.md)         |
| 🔍 故障排除      | [TROUBLESHOOTING_zh.md](docs/TROUBLESHOOTING_zh.md) |
| 📋 更新日志      | [CHANGELOG.md](docs/CHANGELOG.md)                   |
