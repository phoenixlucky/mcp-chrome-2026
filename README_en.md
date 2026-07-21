<p align="center">
  <img src="app/chrome-extension/public/icon/128.png" alt="Chrome MCP Server" width="96" height="96" />
</p>

<h1 align="center">Chrome MCP Server</h1>

<p align="center">
  <b>Bridge AI agents with your Chrome browser</b><br />
  A Model Context Protocol server that exposes 40+ browser capabilities to AI assistants
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

## 📢 What's New in v1.5.2

> **Intent Display** — The browser status overlay now shows the intent behind each AI step, making execution fully transparent.
>
> - 🏷️ **Intent field** — All tools now accept an optional `intent` parameter
> - 🖥️ **Status overlay** — Displays `Intent: xxx` in real-time on the browser page
> - 🔒 **Type safety** — Model selection migrated to `ModelPreset` enum, eliminating runtime risks

> See the [full changelog](docs/CHANGELOG.md) for changes in v1.5.0 and earlier versions.

---

## ✨ Features

|                                                                                           |                                                                               |                                                                                 |                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **🤖 AI-Native Control**<br/>Claude / Cursor / VS Code<br/>operates your browser directly | **🔐 Zero Setup**<br/>Reuses your Chrome<br/>sessions & cookies instantly     | **🛡️ Fully Local**<br/>All processing on-device<br/>no data leaves your machine | **🚄 Streamable HTTP**<br/>Real-time streaming<br/>Modern MCP transport      |
| **🧠 Semantic Search**<br/>Vector DB + local embeddings<br/>cross-tab content discovery   | **⚡ SIMD Acceleration**<br/>WASM-optimized engine<br/>4-8× faster vector ops | **📊 40+ Tools**<br/>Navigation / forms<br/>bookmarks / history / network       | **🔄 Cross-Tab Ops**<br/>Multi-tab & multi-window<br/>seamless orchestration |

---

## ⚔️ vs Playwright-based Alternatives

| Dimension            | Playwright MCP                                | Chrome Extension MCP (This Project)                       |
| -------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **Browser Process**  | Launches separate instance + downloads binary | **Uses your existing Chrome**                             |
| **Login Sessions**   | Re-authenticate every site                    | **Automatically inherited**                               |
| **User Environment** | Clean profile — no extensions, no settings    | **Full user profile** — everything intact                 |
| **API Surface**      | Limited to Playwright API                     | **Full Chrome API** (tabs, bookmarks, history, downloads) |
| **Startup Time**     | Initialize new browser (seconds)              | **Instant** (< 1s)                                        |
| **Latency**          | 50–200ms                                      | **Lower** — in-process communication                      |

---

## 🚀 5-Minute Setup

### 1️⃣ Install the Chrome Extension

Download `chrome-mcp-server-*.zip` from the [Releases page](https://github.com/phoenixlucky/mcp-chrome-2026/releases).

Open `chrome://extensions/` → enable **Developer mode** → drag & drop the `.zip` to install.

### 2️⃣ Install the Native Host

```bash
# npm (recommended — auto-registers)
npm install -g @ethanwilkins/mcp-chrome-bridge-2026

# pnpm
pnpm install -g @ethanwilkins/mcp-chrome-bridge-2026
```

> `postinstall` auto-registers Native Messaging Host. Manual: `mcp-chrome-bridge register`

### 3️⃣ Start the Service

```bash
# One-click start (recommended)
mcp-chrome-bridge start

# Or via the startup script after cloning
start-server.bat
```

The service listens on `http://127.0.0.1:12306/mcp`.

### 4️⃣ Configure Your MCP Client

**Streamable HTTP (Recommended)**

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

**STDIO (Alternative)**

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

## 🛠️ Tools at a Glance

| Category                  | Count | Coverage                                                                              |
| ------------------------- | :---: | ------------------------------------------------------------------------------------- |
| 🖥️ **Browser Management** |   7   | Window/tab listing, navigation, switch, close, go back/forward, script injection      |
| 📷 **Screenshots**        |   1   | Element-level, full-page, custom viewport                                             |
| 🌐 **Network Monitoring** |   4   | Request capture (webRequest / CDP), custom HTTP                                       |
| 📝 **Content Analysis**   |   4   | Semantic search, HTML/text extraction, interactive element detection, console capture |
| 🖱️ **Interaction**        |   3   | Click, fill forms, keyboard input                                                     |
| 📑 **Data Management**    |   4   | History search, bookmark CRUD                                                         |
| 📡 **Scraping**           |  6+   | Scroll, wait, structured extraction, Readability, click-and-wait                      |

📖 Full API reference: [中文](docs/TOOLS_zh.md) · [English](docs/TOOLS.md)

---

## 📚 Usage Guides

| Guide                                               | Description                                            |
| --------------------------------------------------- | ------------------------------------------------------ |
| 🤖 [Smart Assistant Guide](docs/SMART_ASSISTANT.md) | Claude / Codex / DeepSeek sessions & API configuration |
| ⚡ [Quick Tools Guide](docs/QUICK_TOOLS.md)         | Page Quick Panel & popup MCP tool catalog              |

---

## 🎬 Use Cases

| Scenario                           | Prompt                                                                                           | Demo                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 📄 **AI Summary + Excalidraw Viz** | [excalidraw-prompt](prompt/excalidraw-prompt.md)                                                 | [Video](https://www.youtube.com/watch?v=3fBPdUBWVz0)                              |
| 🖼️ **Image Analysis + Excalidraw** | [excalidraw-prompt](prompt/excalidraw-prompt.md) \| [content-analize](prompt/content-analize.md) | [Video](https://www.youtube.com/watch?v=tEPdHZBzbZk)                              |
| 🎨 **Style Injection & Web Mod**   | [modify-web-prompt](prompt/modify-web.md)                                                        | [Video](https://youtu.be/twI6apRKHsk)                                             |
| 📡 **Network Request Analysis**    | —                                                                                                | [Video](https://youtu.be/1hHKr7XKqnQ)                                             |
| 📊 **Browsing History Analysis**   | —                                                                                                | [Video](https://youtu.be/jf2UZfrR2Vk)                                             |
| 💬 **Web Page Conversation**       | —                                                                                                | [Video](https://youtu.be/FlJKS9UQyC8)                                             |
| 📸 **Page & Element Screenshots**  | —                                                                                                | [Video 1](https://youtu.be/7ycK6iksWi4) · [Video 2](https://youtu.be/ev8VivANIrk) |
| 🔖 **Bookmark Management**         | —                                                                                                | [Video](https://youtu.be/R_83arKmFTo)                                             |
| 🗑️ **Batch Tab Closure**           | —                                                                                                | [Video](https://youtu.be/2wzUT6eNVg4)                                             |

---

## 🗺️ Roadmap

| ✅ Done                                                                       | 🎯 Planned                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **40+ MCP Tools** — Full browser API coverage                                 | **Auth & Permission** — API Key / OAuth                      |
| **Streamable HTTP + STDIO** — Dual transport                                  | **Tool-level ACL** — Per-client tool permissions             |
| **Smart Assistant** — Claude / Codex / DeepSeek                               | **Monitoring Dashboard** — Web panel for calls, perf, errors |
| **Semantic Search** — Vector DB + local embeddings                            | **Cross-platform Setup** — macOS / Linux one-click scripts   |
| **SIMD Acceleration** — WASM engine 4-8× faster                               |                                                              |
| **Workflow Recording & Replay** — v3 unified architecture (v2 fully migrated) |                                                              |
| **Visual Editor** — Drag-and-drop workflow builder                            |                                                              |
| **Native Messaging Auto-registration**                                        |                                                              |

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) before submitting a PR.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

## 📖 Documentation

| Document                 | Link                                          |
| ------------------------ | --------------------------------------------- |
| 🏗️ Architecture          | [ARCHITECTURE.md](docs/ARCHITECTURE.md)       |
| 🔧 Tool API Reference    | [TOOLS.md](docs/TOOLS.md)                     |
| 🤖 Smart Assistant Guide | [SMART_ASSISTANT.md](docs/SMART_ASSISTANT.md) |
| ⚡ Quick Tools Guide     | [QUICK_TOOLS.md](docs/QUICK_TOOLS.md)         |
| 🔍 Troubleshooting       | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| 📋 Changelog             | [CHANGELOG.md](docs/CHANGELOG.md)             |
