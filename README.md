<p align="center">
  <img src="app/chrome-extension/public/icon/128.png" alt="Chrome MCP Server" width="96" height="96" />
</p>

<h1 align="center">Chrome MCP Server</h1>

<p align="center">
  <b>让 AI 直接操控你的 Chrome 浏览器</b><br />
  基于 Model Context Protocol，向 AI 助手开放 40+ 浏览器能力
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

## 📢 v1.5.2 更新内容

> **操作意图显示** — AI 执行时，浏览器状态叠加层清晰展示每一步的意图信息。
>
> - 🏷️ **intent 字段** — 所有工具输入新增可选意图字段
> - 🖥️ **状态叠加层** — 实时显示"意图：xxx"，执行过程透明可见
> - 🔒 **类型安全** — 模型选择改用 `ModelPreset` 枚举，消除运行时隐患

## 📢 v1.5.0 更新内容

> **工作流引擎 v3 架构统一** — 旧版 record-replay v2 代码已全面迁移至 v3 统一架构。
>
> - 🧹 移除 v2 旧引擎、旧录制模块、旧节点系统（共 50+ 文件）
> - 🏗️ 动作处理器统一为 `record-replay-v3/actions` 模块
> - 🔌 插件系统重构为 `action-node-adapter` + `register-action-nodes`
> - 📦 新增 `public-api` / `builder-types` / `utils` 公共模块
> - 📉 净减少 ~12,300 行旧代码
> - 📦 v1.5.0 之前的旧版本源码已归档至 `V2toV3` 分支

---

## ✨ 核心特性

|                                                                     |                                                                    |                                                               |                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------- |
| **🤖 AI 原生控制**<br/>Claude / Cursor / VS Code<br/>直接操控浏览器 | **🔐 零配置即用**<br/>复用现有 Chrome<br/>登录态 / Cookie 即刻继承 | **🛡️ 纯本地运行**<br/>数据不出环境<br/>隐私安全有保障         | **🚄 Streamable HTTP**<br/>实时流式响应<br/>现代 MCP 传输协议 |
| **🧠 语义搜索**<br/>向量数据库 + 本地嵌入<br/>跨标签页内容发现      | **⚡ SIMD 加速**<br/>WASM 优化引擎<br/>向量运算 4-8× 更快          | **📊 40+ 工具**<br/>导航 / 截图 / 表单<br/>书签 / 历史 / 网络 | **🔄 跨标签页操作**<br/>多标签 / 多窗口<br/>无缝协同管理      |

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
npm install -g @ethanwilkins/mcp-chrome-bridge-2026

# pnpm
pnpm install -g @ethanwilkins/mcp-chrome-bridge-2026
```

> `postinstall` 自动注册 Native Messaging Host。如需手动注册：`mcp-chrome-bridge register`

### 3️⃣ 启动服务

```bash
# 一键启动（推荐）
mcp-chrome-bridge start

# 或克隆仓库后用脚本
start-server.bat
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

## 🛠️ 工具一览

| 分类              | 数量 | 覆盖能力                                              |
| ----------------- | :--: | ----------------------------------------------------- |
| 🖥️ **浏览器管理** |  7   | 窗口/标签页列表、导航、切换、关闭、前进后退、脚本注入 |
| 📷 **截图**       |  1   | 元素级、全页面、自定义视口                            |
| 🌐 **网络监控**   |  4   | 请求捕获（webRequest / CDP）、自定义 HTTP             |
| 📝 **内容分析**   |  4   | 语义搜索、HTML / 文本提取、交互元素检测、控制台日志   |
| 🖱️ **交互操作**   |  3   | 点击、表单填充、键盘输入                              |
| 📑 **数据管理**   |  4   | 历史搜索、书签增删查                                  |
| 📡 **采集提取**   |  6+  | 滚动、等待、结构化提取、Readability、点击等待组合     |

📖 完整 API 参考：[中文](docs/TOOLS_zh.md) · [English](docs/TOOLS.md)

---

## 📚 使用指南

| 指南                                          | 说明                                      |
| --------------------------------------------- | ----------------------------------------- |
| 🤖 [智能助手指南](docs/SMART_ASSISTANT_zh.md) | Claude / Codex / DeepSeek 会话与 API 配置 |
| ⚡ [快捷工具指南](docs/QUICK_TOOLS_zh.md)     | 页面 Quick Panel 和插件弹窗 MCP 工具目录  |

---

## 🎬 使用场景

| 场景                               | 操作                    | 演示                                                                            |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| 📄 **AI 总结 + Excalidraw 可视化** | 总结页面内容并画图      | [视频](https://www.youtube.com/watch?v=3fBPdUBWVz0)                             |
| 🖼️ **图片分析 + Excalidraw 复现**  | 分析图片内容并重建      | [视频](https://www.youtube.com/watch?v=tEPdHZBzbZk)                             |
| 🎨 **样式注入与网页修改**          | 修改页面样式去广告      | [视频](https://youtu.be/twI6apRKHsk)                                            |
| 📡 **网络请求捕获分析**            | 查找 API 端点与响应结构 | [视频](https://youtu.be/1hHKr7XKqnQ)                                            |
| 📊 **浏览历史分析**                | 分析近一个月浏览记录    | [视频](https://youtu.be/jf2UZfrR2Vk)                                            |
| 💬 **网页对话**                    | 翻译并总结当前页面      | [视频](https://youtu.be/FlJKS9UQyC8)                                            |
| 📸 **页面与元素截图**              | 截取首页 / 捕获图标     | [视频 1](https://youtu.be/7ycK6iksWi4) · [视频 2](https://youtu.be/ev8VivANIrk) |
| 🔖 **书签管理**                    | 将当前页添加到书签      | [视频](https://youtu.be/R_83arKmFTo)                                            |
| 🗑️ **批量关闭标签页**              | 关闭匹配关键词的标签页  | [视频](https://youtu.be/2wzUT6eNVg4)                                            |

---

## 🗺️ 路线图

| ✅ 已实现                                           | 🎯 规划中                                         |
| --------------------------------------------------- | ------------------------------------------------- |
| **40+ MCP 工具** — 浏览器全能力覆盖                 | **认证与权限管理** — API Key / OAuth 接入         |
| **Streamable HTTP + STDIO 双传输**                  | **工具级 ACL** — 精细控制每个客户端的工具权限     |
| **智能助手** — Claude / Codex / DeepSeek            | **实时监控仪表盘** — Web 面板查看调用、性能、错误 |
| **语义搜索** — 向量数据库 + 本地嵌入                | **跨平台安装体验** — macOS / Linux 一键脚本       |
| **SIMD 加速** — WASM 引擎 4-8× 更快                 |                                                   |
| **工作流录制与回放** — v3 统一架构（v2 已完全迁移） |                                                   |
| **可视化编辑器** — 拖拽搭建工作流                   |                                                   |
| **Native Messaging 自动注册**                       |                                                   |

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
