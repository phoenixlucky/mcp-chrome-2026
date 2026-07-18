# Chrome MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)

> **Bridge AI agents with your Chrome browser** — A Model Context Protocol (MCP) server that exposes Chrome browser capabilities to AI assistants for browser automation, content analysis, and data extraction.

**📖 Language**: [中文](README.md) | [English](README_en.md)

---

## Overview

Chrome MCP Server is a **Model Context Protocol (MCP) server** built as a Chrome extension. It grants AI assistants direct control over your browser through **40+ tools** — navigate pages, extract data, take screenshots, monitor networks, manage bookmarks, and more.

Unlike Playwright-based MCP servers, this extension operates on your **existing Chrome instance**, preserving your login sessions, cookies, extensions, and user preferences. No separate browser process, no re-authentication.

## Features

- **🤖 AI-Native Browser Control** — Let any MCP-compatible client (Claude, Cursor, VS Code extensions, etc.) automate your browser
- **🔐 Zero Setup, Reuse Your Browser** — Works with your existing Chrome — all login sessions, bookmarks, and settings are immediately available
- **🛡️ Fully Local** — All processing stays on your machine; no data leaves your environment
- **🚄 Streamable HTTP Transport** — Modern MCP transport for real-time streaming responses
- **🧠 Semantic Search** — Built-in vector database with local embedding models for cross-tab content discovery
- **📊 40+ Tools** — Comprehensive browser API coverage: navigation, screenshots, network capture, content analysis, form interaction, bookmark/history management, and structured data extraction
- **⚡ SIMD Acceleration** — Custom WebAssembly SIMD optimizations deliver 4–8× faster vector operations for AI workloads
- **🔄 Cross-Tab Context** — Operate across multiple tabs and windows seamlessly

## Comparison with Playwright-based Alternatives

| Dimension                 | Playwright-based MCP                                                                | Chrome Extension MCP (This Project)                                          |
| ------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Browser Process**       | Launches a separate browser instance; requires Playwright + browser binary download | Uses your existing Chrome directly                                           |
| **Login Sessions**        | Requires re-authentication to every site                                            | Automatically inherits existing sessions                                     |
| **User Environment**      | Clean profile — no extensions, no settings                                          | Full user profile — extensions, cookies, preferences intact                  |
| **API Surface**           | Limited to Playwright's API                                                         | Full Chrome extension API access (tabs, bookmarks, history, downloads, etc.) |
| **Startup Time**          | Must launch and initialize a new browser                                            | Extension activates instantly                                                |
| **Inter-Process Latency** | 50–200ms (browser protocol)                                                         | Lower latency (in-process communication)                                     |

## Quick Start

### Prerequisites

- Node.js >= 20.0.0 (this repository pins pnpm 11.14.0 through Corepack)
- Chrome or Chromium browser

### Installation

#### 1. Install the Chrome Extension

Download the latest `chrome-mcp-server-*.zip` from the [Releases page](https://github.com/phoenixlucky/mcp-chrome-2026/releases).

Load it in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Drag and drop the `.zip` file onto the page to install
4. The extension icon appears in the toolbar

#### 2. Install the Native Host

```bash
# npm (auto-registers Native Messaging Host via postinstall)
npm install -g @ethanwilkins/mcp-chrome-bridge-2026

# pnpm
pnpm install -g @ethanwilkins/mcp-chrome-bridge-2026
```

The `postinstall` script automatically registers the Native Messaging Host. If registration fails, run manually:

```bash
mcp-chrome-bridge register
```

#### 3. Start the Service

```bash
# One-click start (recommended)
mcp-chrome-bridge start

# Or via the startup script after cloning the repo
start-server.bat
```

The native host listens for connections from the Chrome extension and starts an MCP HTTP server on `http://127.0.0.1:12306/mcp`.

### Configure Your MCP Client

#### Streamable HTTP (Recommended)

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

#### STDIO (Alternative)

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

> Full changelog at [CHANGELOG](docs/CHANGELOG.md)

## Tools

| Category               | Tools | Description                                                                                  |
| ---------------------- | ----- | -------------------------------------------------------------------------------------------- |
| **Browser Management** | 7     | Window/tab listing, navigation, switch, close, go back/forward, script injection             |
| **Screenshots**        | 1     | Element-level, full-page, and custom-viewport screenshots                                    |
| **Network Monitoring** | 4     | Request capture (webRequest/Debugger API), custom HTTP requests                              |
| **Content Analysis**   | 4     | Semantic search, HTML/text extraction, interactive element detection, console output capture |
| **Interaction**        | 3     | Click, fill forms, keyboard input                                                            |
| **Data Management**    | 4     | History search, bookmark CRUD                                                                |
| **Scraping**           | 6+    | Tab URL, scroll, wait, structured extraction, Readability extraction, click-and-wait         |

Full API reference: [中文](docs/TOOLS_zh.md) | [English](docs/TOOLS.md)

## Usage Guides

- [Smart Assistant Guide](docs/SMART_ASSISTANT.md) | [中文](docs/SMART_ASSISTANT_zh.md): Claude, Codex, DeepSeek sessions, and API configuration.
- [Quick Tools Guide](docs/QUICK_TOOLS.md) | [中文](docs/QUICK_TOOLS_zh.md): the page Quick Panel and popup MCP tool catalog.

## Usage Examples

### AI-Powered Page Summarization + Excalidraw Visualization

**Prompt**: [excalidraw-prompt](prompt/excalidraw-prompt.md)  
**Instruction**: Summarize the current page and draw a diagram to illustrate the content.  
[Demo video](https://www.youtube.com/watch?v=3fBPdUBWVz0)

### AI-Driven Image Reconstruction in Excalidraw

**Prompt**: [excalidraw-prompt](prompt/excalidraw-prompt.md) | [content-analize](prompt/content-analize.md)  
**Instruction**: Analyze the image content and replicate it using Excalidraw.  
[Demo video](https://www.youtube.com/watch?v=tEPdHZBzbZk)

### Style Injection & Webpage Modification

**Prompt**: [modify-web-prompt](prompt/modify-web.md)  
**Instruction**: Modify the current page styles and remove advertisements.  
[Demo video](https://youtu.be/twI6apRKHsk)

### Network Request Capture & Analysis

**Instruction**: Identify search API endpoints and inspect response structures.  
[Demo video](https://youtu.be/1hHKr7XKqnQ)

### Browsing History Analysis

**Instruction**: Analyze the past month's browsing history.  
[Demo video](https://youtu.be/jf2UZfrR2Vk)

### Web Page Conversation

**Instruction**: Translate and summarize the current web page.  
[Demo video](https://youtu.be/FlJKS9UQyC8)

### Page & Element Screenshots

**Instruction**: Screenshot Hugging Face's homepage / capture a specific icon element.  
[Demo video: page](https://youtu.be/7ycK6iksWi4) | [Demo video: element](https://youtu.be/ev8VivANIrk)

### Bookmark Management

**Instruction**: Add the current page to bookmarks in the appropriate folder.  
[Demo video](https://youtu.be/R_83arKmFTo)

### Batch Tab Closure

**Instruction**: Close all tabs matching a keyword.  
[Demo video](https://youtu.be/2wzUT6eNVg4)

## Project Roadmap

- [ ] Authentication & permission management
- [ ] Recording and playback of browser workflows
- [ ] Visual workflow automation builder
- [ ] Firefox extension support

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) before submitting a pull request.

## License

MIT — see [LICENSE](LICENSE) for details.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Tool API Reference](docs/TOOLS.md)
- [Smart Assistant Guide](docs/SMART_ASSISTANT.md)
- [Quick Tools Guide](docs/QUICK_TOOLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
