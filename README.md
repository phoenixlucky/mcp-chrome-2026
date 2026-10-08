<p align="center">
  <img src="app/chrome-extension/public/icon/128.png" alt="Chrome MCP Server" width="96" height="96" />
</p>

<h1 align="center">Chrome MCP Server</h1>

<p align="center">
  <b>Bridge AI agents with your Chrome browser</b><br />
  A Model Context Protocol server that exposes 80 browser capabilities to AI assistants<br />
  <b>New MCP: ultra-low latency, instant responses — local round-trips in under 50ms</b>
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
    <a href="README_zh.md">🇨🇳 Chinese</a> ·
    <b>🇬🇧 English</b>
  </b>
</p>

---

## 📢 What's New in v2.8.5

> **Stronger page collection and review workflows** — Better support for multi-page content, comment threads, and long lists.
>
> - 🕸️ **Recursive page crawling** — `chrome_crawl_links` supports same-origin limits, depth/node caps, retries, field extraction, and partial failure results.
> - 💬 **Comment and reply extraction** — `chrome_extract_thread` supports scroll loading, nested-item filtering, field mapping, and stop conditions.
> - 📊 **Stronger long-list collection** — Virtual-list, paginated, and multi-tab collection workflows expose independent state, progress snapshots, and diagnostics.
> - 🧭 **Improved review tools** — Page review summaries and expandable sections support finer stop conditions and bounded clicks.
> - 🖥️ **Desktop assistant and runtime improvements** — Better attachment handling, runtime registration, and desktop interaction stability.
> - 🔧 All release packages bumped to v2.8.5

> See the [full changelog](docs/CHANGELOG.md) for all version changes.

---

## 🖼️ Screenshots

<p align="center">
  <table style="border-collapse: collapse; width: 100%; max-width: 960px; margin: 0 auto;">
    <tr>
      <td align="center" style="padding: 8px 12px;"><b>Popup Window</b></td>
      <td align="center" style="padding: 8px 12px;"><b>Builder Workflow Editor</b></td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/popup-ui.webp" alt="Popup" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/builder-ui.webp" alt="Builder" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">Catgirl frosted-glass theme,<br/>MCP tools at a glance</td>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">Drag-and-drop workflow builder,<br/>record & replay automation</td>
    </tr>
    <tr>
      <td align="center" style="padding: 8px 12px;"><b>Quick Panel</b></td>
      <td align="center" style="padding: 8px 12px;"><b>Smart Assistant</b></td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/quick-panel.webp" alt="Quick Panel" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/assistant-ui.webp" alt="Smart Assistant" width="100%" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">In-page quick tools,<br/>element picker & actions</td>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">Sidepanel chat,<br/>Claude / Codex / DeepSeek</td>
    </tr>
  </table>
</p>

## 🖥️ Windows Desktop Client

`chrome-mcp-desktop-2.8.5-win-x64.exe` is the portable Windows desktop manager (Tauri 2 + Vue) shipped with the project. It bundles the bridge runtime, so a double-click starts or reuses the local Chrome MCP service without installing Node.js; the Chrome extension still has to be installed and connected using the steps above.

![Chrome MCP Bridge Windows desktop client](screenshots/desktop-client.webp)

### Download and Usage

1. Download [`chrome-mcp-desktop-2.8.5-win-x64.exe`][desktop-v2.8.5] from the [v2.8.5 Release][release-v2.8.5], put the file in a writable directory, and double-click it to run.
2. The client starts or reuses the local bridge service on `http://127.0.0.1:12306` automatically; if the status shows "Waiting for connection", make sure the Chrome extension is loaded and click the connect button in the extension.
3. The console shows service status, Chrome extension connection, Native Host connection, MCP sessions, available tools, running tasks, service endpoints, and error diagnostics; click "Refresh status" or "Health check" to probe again.
4. Closing the window minimizes the client to the system tray. The tray menu can show the client again, run a health check immediately, or choose "Exit client (stop service)" to fully quit and stop the service owned by the client.

The desktop client uses the following MCP endpoints; client configuration is the same as with other installation methods:

| Endpoint                    | Address or configuration                                         |
| --------------------------- | ---------------------------------------------------------------- |
| Streamable HTTP (compat)    | `http://127.0.0.1:12306/mcp`                                     |
| Streamable HTTP (stateless) | `http://127.0.0.1:12306/mcp-new`                                 |
| SSE (legacy)                | `http://127.0.0.1:12306/sse`                                     |
| STDIO                       | Use the standalone `chrome-mcp-bridge-2.8.5-win-x64.exe --stdio` |

> Note: `chrome-mcp-desktop-2.8.5-win-x64.exe` is a GUI management client; do not use it directly as a STDIO MCP `command`. When you need STDIO, use the bridge runtime EXE with `--stdio`; open the desktop client when you need to manage the service.

[desktop-v2.8.5]: https://github.com/phoenixlucky/mcp-chrome-2026/releases/download/v2.8.5/chrome-mcp-desktop-2.8.5-win-x64.exe

## ✨ Features

|                                                                                           |                                                                               |                                                                                 |                                                                                        |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **🤖 AI-Native Control**<br/>Claude / Cursor / VS Code<br/>operates your browser directly | **🔐 Zero Setup**<br/>Reuses your Chrome<br/>sessions & cookies instantly     | **🛡️ Fully Local**<br/>All processing on-device<br/>no data leaves your machine | **🚄 New MCP**<br/>Ultra-low latency, instant responses<br/>local round-trips in <50ms |
| **🧠 Semantic Search**<br/>Vector DB + local embeddings<br/>cross-tab content discovery   | **⚡ SIMD Acceleration**<br/>WASM-optimized engine<br/>4-8× faster vector ops | **📊 80 Tools**<br/>Navigation / forms<br/>bookmarks / history / network        | **🔄 Cross-Tab Ops**<br/>Multi-tab & multi-window<br/>seamless orchestration           |

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

> First time? Just complete steps 1 → 4 below. Windows users should use the desktop client; macOS / Linux users, or anyone comfortable with the command line, can use the Node.js route.

### 1️⃣ Install the Chrome Extension

1. Download the [Chrome extension package][extension-v2.8.5] from the [v2.8.5 Release][release-v2.8.5].
2. Unzip the downloaded `.zip` file.
3. Open `chrome://extensions/` in the Chrome address bar and turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the folder you just unzipped.
5. Click the Chrome MCP icon in the browser toolbar, then click **Connect**.

Once the extension shows as connected, keep Chrome open and continue to the next step.

[release-v2.8.5]: https://github.com/phoenixlucky/mcp-chrome-2026/releases/tag/v2.8.5
[extension-v2.8.5]: https://github.com/phoenixlucky/mcp-chrome-2026/releases/download/v2.8.5/chrome-mcp-server-2.8.5-chrome.zip

### 2️⃣ Start the Local Service (Pick One)

#### Windows: Use the desktop client (recommended)

1. Download [`chrome-mcp-desktop-2.8.5-win-x64.exe`][desktop-v2.8.5].
2. Double-click the EXE; the client starts or reuses the local service automatically.
3. Once the client shows "Service status: Running" and "Chrome extension: Connected", you're set.

The desktop client is portable and needs no Node.js installation. It can also show MCP sessions, tool calls, running tasks, and error diagnostics. Closing the window does not stop the service; it minimizes to the system tray.

#### macOS / Linux or command line: use Node.js

First install Node.js 24 or later, then run in a terminal:

```bash
npm install -g --allow-scripts=@ethanwilkins/mcp-chrome-bridge-2026 @ethanwilkins/mcp-chrome-bridge-2026
mcp-chrome-bridge start
```

Once the npm install finishes it registers the Native Host Chrome needs. The service listens on `http://127.0.0.1:12306` by default.

> Windows users who already use the desktop client don't need to repeat the Node.js install and start commands; pick one of the two routes.

### 3️⃣ Add the MCP Service to Your AI Client

In the MCP settings of an AI client such as Claude, Cherry Studio, or Cursor, add a new server, choose **Streamable HTTP** (some clients write it as `streamableHttp`), and fill in:

```text
Address: http://127.0.0.1:12306/mcp
```

If your client needs JSON config, use:

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

If your client only supports STDIO, use the bridge runtime, not the GUI desktop client:

```json
{
  "mcpServers": {
    "chrome-mcp-bridge": {
      "command": "D:\\path\\chrome-mcp-bridge-2.8.5-win-x64.exe",
      "args": ["--stdio"]
    }
  }
}
```

### 4️⃣ Verify It Works

1. Go back to your AI client and refresh the MCP server or reopen the session.
2. Seeing the Chrome MCP tool list (e.g. `chrome_get_tab_url`, `chrome_screenshot`) means the connection succeeded.
3. Send a simple test prompt:

   > Read the title and URL of my current Chrome tab.

If the desktop client shows "Waiting for connection", first check whether the Chrome extension's **Connect** button was clicked; you can also open `http://127.0.0.1:12306/status?probe=1` in the browser to check the status.

### Advanced Configuration (Safe to Skip on First Use)

#### Faster stateless endpoint

Clients that support the new MCP 2026-07-28 revision can use:

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

This endpoint works per request and stores no session; lightweight requests can respond in **under 50ms**. See the [`/mcp-new` endpoint reference](docs/MCP_NEW_zh.md) for the full headers, `_meta` structure, and debugging examples. If your client cannot customize new-protocol fields such as `Origin`, keep using `/mcp` above.

#### Legacy SSE clients

Clients that need the old SSE protocol should use:

- SSE endpoint: `http://127.0.0.1:12306/sse`
- Message endpoint: `http://127.0.0.1:12306/messages?sessionId=...`

#### Other ways to start STDIO

After installing the npm package, you can also run:

```bash
mcp-chrome-bridge stdio
```

`mcp-chrome-bridge --stdio` prefers `/mcp-new` and falls back to `/mcp` on failure; if the local service is not running, it starts and reuses it automatically. To force the service to be started by an external process, set `CHROME_MCP_AUTOSTART_SERVER=0`. The legacy `mcp-chrome-stdio` entry point remains compatible.

#### Windows developers: build the portable EXE

In the repository root, double-click `package-desktop-windows.bat` and choose Desktop client when prompted. The script checks version consistency and produces:

```text
releases/chrome-mcp-desktop-<version>-win-x64.exe
```

If you only need the bridge runtime, `package-windows.bat` builds `chrome-mcp-bridge-<version>-win-x64.exe`.

#### Protect the HTTP MCP endpoint

By default the service only listens locally and needs no API key. To protect the HTTP / SSE endpoints, set this before starting the service:

```powershell
$env:CHROME_MCP_API_KEY = "replace-with-a-long-random-key"
mcp-chrome-bridge start
```

Clients can then send `Authorization: Bearer <key>` (or `x-api-key`); the STDIO proxy reads the same environment variable and forwards the Bearer token automatically. HTTP MCP requests without an `Origin` must carry a valid API key.

#### Concurrency and tool permissions

By default the service runs at most 8 tool calls concurrently and queues at most 64. Tune this to your machine:

```powershell
$env:CHROME_MCP_MAX_CONCURRENT_TOOLS = "8"
$env:CHROME_MCP_MAX_QUEUED_TOOLS = "64"
mcp-chrome-bridge start
```

You can also restrict which tools a client can see and require approval for high-risk tools:

```powershell
$env:CHROME_MCP_ALLOWED_TOOLS = "chrome_read_page,chrome_get_tab_url,flow.*"
$env:CHROME_MCP_REQUIRE_APPROVAL = "true"
$env:CHROME_MCP_APPROVED_TOOLS = "flow.checkout"
```

With `CHROME_MCP_REQUIRE_APPROVAL=true`, high-risk tools such as JavaScript execution, write/publish, file upload, Profile management, and `flow.*` must also appear in the approval list. Leaving these variables unset preserves the existing compatibility behavior.

More advanced environment variables (extension ID, Origin allowlist, request body size, and Artifact limits) are in the [troubleshooting guide](docs/TROUBLESHOOTING_zh.md).

---

## 🧩 Isolated Browser Profiles

By default, browser tools continue to control the Chrome you are currently using. For account, cookie, or cache isolation, call `chrome_profile` first:

```json
{ "action": "create", "name": "Work account", "profileId": "work" }
```

Then add `profileId` to a normal browser tool; an isolated Chrome instance starts automatically when needed:

```json
{ "profileId": "work", "url": "https://example.com" }
```

Use `chrome_profile` with `list`, `status`, `diagnostics`, `launch`, `stop`, or `delete` to manage profiles. `delete` removes only the profile configuration and keeps `userDataDir`, preventing accidental loss of login state. Set `CHROME_MCP_EXTENSION_PATH` when the isolated Chrome must load a locally built extension.

Click, input, scroll, and navigation actions use a unified `balanced` pace by default; pass `actionPolicy: "fast"` or `actionPolicy: "human"` when needed.

Use `chrome_batch` to run up to 50 browser calls sequentially as one task; pass `profileId` to pin the batch to one isolated Profile. Workflow v3 already provides persistent queues plus cron/interval triggers.

### Safe upgrades

```bash
mcp-chrome-bridge upgrade 2.3.0 --dry-run
mcp-chrome-bridge upgrade 2.3.0
```

Upgrades require an exact version and verify npm SHA-512 integrity. If post-install validation of key files fails, the command attempts to roll back to the previous version.

### ✅ Verification

- Native Server: 5 Jest suites, 18 tests (including permission policy and HTTP auth), run by CI with coverage collection
- Chrome Extension: 58 Vitest files, 567 tests, run by CI
- Native / Extension / Shared TypeScript checks passed
- Version consistency: `pnpm check:versions`
- Tool docs: `pnpm check:tool-docs`

### Real Chrome smoke test

This test does not use jsdom, fake IndexedDB, or mocked Chrome APIs. Install/load the extension, wait for the Native Host connection, and start the HTTP server first, then run:

```powershell
pnpm test:chrome-smoke
```

It checks the Native Host extension connection and browser probe, creates a real MCP session, discovers the catalog, and calls `chrome_get_tab_url` against the current Chrome tab. Use `CHROME_MCP_SMOKE_URL`, `CHROME_MCP_SMOKE_TIMEOUT_MS`, and `CHROME_MCP_API_KEY` to override the connection settings.

---

## 🛠️ Tools at a Glance

| Category                  | Count | Coverage                                                                                          |
| ------------------------- | :---: | ------------------------------------------------------------------------------------------------- |
| 🖥️ **Browser Management** |  12   | Window/tab listing, new tabs, navigation, switch, close, current URL, scroll, Profile/batch tasks |
| 📷 **Screenshots & PDF**  |   3   | Element-level, full-page, custom viewport, GIF recording, page-to-PDF printing                    |
| 🌐 **Network Monitoring** |   6   | Request capture & response wait, resource blocking, custom HTTP, download handling                |
| 📝 **Content Analysis**   |   7   | Semantic search, HTML/text extraction, interactive elements, console capture, SPA                 |
| 🖱️ **Interaction**        |  11   | Click, hover, fill forms, keyboard, element info, computer ops, dialogs, file upload              |
| 📑 **Data Management**    |  11   | History search, bookmark CRUD, Cookie management, page local/sessionStorage, userscripts          |
| 📡 **Scraping**           |  16   | Scoped/Shadow DOM/iframe, pagination, isolated task state, diagnostics, proxy rotate              |
| ⚡ **Performance**        |   3   | Trace start / stop / insight analysis                                                             |

📖 Full API reference: [Chinese](docs/TOOLS_zh.md) · [English](docs/TOOLS.md)

---

## 📚 Usage Guides

| Guide                                                  | Description                                            |
| ------------------------------------------------------ | ------------------------------------------------------ |
| 🤖 [Smart Assistant Guide](docs/SMART_ASSISTANT_zh.md) | Claude / Codex / DeepSeek sessions & API configuration |
| ⚡ [Quick Tools Guide](docs/QUICK_TOOLS_zh.md)         | Page Quick Panel & popup MCP tool catalog              |

---

## 🎬 Use Cases

| Scenario                           | Action                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| 📄 **AI Summary + Excalidraw Viz** | Summarize page content and draw a diagram                 |
| 🖼️ **Image Analysis + Excalidraw** | Analyze image content and rebuild it                      |
| 🎨 **Style Injection & Web Mod**   | Modify page styles to strip ads                           |
| 📡 **Network Request Analysis**    | Find API endpoints and response structures                |
| 📊 **Browsing History Analysis**   | Analyze the past month of browsing records                |
| 💬 **Web Page Conversation**       | Translate and summarize the current page                  |
| 📸 **Page & Element Screenshots**  | Capture the first screen / capture icons                  |
| 🔖 **Bookmark Management**         | Add the current page to bookmarks                         |
| 🗑️ **Batch Tab Closure**           | Close tabs matching a keyword                             |
| 🤖 **Smart Assistant Chat**        | Chat with Claude / Codex / DeepSeek in the sidebar        |
| 🔄 **Workflow Record & Replay**    | Record repetitive actions and replay them with one click  |
| 🧩 **Visual Workflow Builder**     | Build automation flows by dragging nodes in the Builder   |
| 📊 **Page Data Extraction**        | Extract structured data from lists / virtual scroll pages |
| ⚡ **Page Performance Analysis**   | Record a trace and analyze loading bottlenecks            |
| 🎥 **Record Actions as GIF**       | Record page interactions as a GIF                         |

---

## 🗺️ Roadmap

### ✅ Done

- **80 MCP Tools** — Full browser API coverage, including public `chrome_userscript`, page collection, and thread extraction tools
- **Streamable HTTP (compatibility / early access) + SSE + STDIO** — All transports retained
- **Smart Assistant** — Claude / Codex / DeepSeek
- **Semantic Search** — Vector DB + local embeddings
- **SIMD Acceleration** — WASM engine 4-8× faster
- **Workflow Recording & Replay** — v3 unified architecture (legacy architecture fully migrated)
- **Visual Editor** — Drag-and-drop workflow builder
- **Native Messaging Auto-registration**
- **Cross-platform Setup** — macOS / Linux one-click scripts
- **Multi-Profile Isolation** — Separate cookies, cache, history and login state
- **Persistent Sessions** — Restore isolated profiles after browser close
- **Unified ActionPolicy** — Stable click / input / scroll pacing
- **Parallel Sessions** — Separate MCP/CDP channels per profile
- **Profile Diagnostics** — Profile, CDP, MCP, proxy and extension state
- **Safe Upgrades** — Exact versions, SHA-512 verification and rollback
- **Batch and Scheduled Tasks** — `chrome_batch`, workflow queues and cron/interval triggers
- **Native Messaging control channel and concurrency governance** — Global concurrency cap and global queue cap (`CHROME_MCP_MAX_CONCURRENT_TOOLS=8` / `CHROME_MCP_MAX_QUEUED_TOOLS=64`), serialized writes to the same tab, `chrome_batch` not consuming extra outer concurrency slots, and `/status` `toolAdmission` exposing occupancy and queueing in real time
- **Authentication and Permissions** — HTTP API keys, tool scopes, and high-risk action approvals
- **Live Monitoring Panel** — The desktop client shows MCP calls, active requests, latency, and error diagnostics
- **Three-Layer Channel Architecture** — Native Messaging control channel, Artifact data plane, and localhost WebSocket event channel

### 🎯 Planned

- **OAuth** — Third-party identity authentication and authorization
- **Multi-version Chrome Matrix** — Run real-browser regression tests across Chrome versions / profiles / environments
- **Expanded Product Scope** — Hosted browsers and remote CDP

### 🆕 New Tools

| Tool                                    | Description                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `chrome_crawl_links`                    | Recursively visit page links with depth/node limits, same-origin filtering, retries, and extraction |
| `chrome_extract_thread`                 | Extract comments or replies with scroll loading, nested-item filtering, and stop conditions         |
| `chrome_create_tab`                     | Create new tab — supports url, windowId, active/background, pinned                                  |
| `chrome_hover`                          | Hover element — trigger hover state via CSS/XPath selector for dropdowns / tooltips / submenus      |
| `chrome_print_to_pdf`                   | Print to PDF — uses CDP Page.printToPDF, supports page/custom paper sizes                           |
| `chrome_get_element_info`               | Element info query — get attributes, computed styles, bounding rect for a selector                  |
| `chrome_storage_get` / `set` / `delete` | Storage management — read/write localStorage / sessionStorage                                       |

The PDF tool returns Base64 PDF data by default; pass `savePdf: true` to also save it to Chrome downloads. The page storage tools operate on the target tab's `localStorage` or `sessionStorage`, not the extension's own storage.

---

## 💝 Support & Sponsorship

The project is fully open source and free. If you find it useful, or need technical support / new feature suggestions, feel free to contact the author through the channels below.

**Sponsorship unlocks premium extension features 🔓** — your support keeps development going!

<p align="center">
  <table style="border-collapse: collapse; width: 100%; max-width: 960px; margin: 0 auto;">
    <tr>
      <td align="center" style="padding: 8px 12px;"><b>WeChat · Chat & Technical Support</b></td>
      <td align="center" style="padding: 8px 12px;"><b>Alipay · Sponsorship</b></td>
      <td align="center" style="padding: 8px 12px;"><b>WeChat Pay · Sponsorship</b></td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/support-wechat-friend.webp" alt="WeChat add friend" width="240" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/support-alipay.webp" alt="Alipay sponsorship" width="240" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
      <td align="center" style="padding: 6px 12px;">
        <img src="screenshots/support-wechat-pay.webp" alt="WeChat Pay sponsorship" width="240" loading="lazy"
             style="border-radius: 12px; border: 1px solid rgba(127,127,127,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">Scan to add me on WeChat,<br/>get technical support and chat</td>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">Scan to sponsor,<br/>unlock premium extension features</td>
      <td align="center" style="padding: 6px 12px; font-size: 0.9em; color: #6e7781;">Scan to sponsor,<br/>unlock premium extension features</td>
    </tr>
  </table>
</p>

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING_zh.md](docs/CONTRIBUTING_zh.md) before submitting a PR.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

## 📖 More Documentation

| Document                     | Link                                                |
| ---------------------------- | --------------------------------------------------- |
| 🏗️ Architecture Design       | [ARCHITECTURE_zh.md](docs/ARCHITECTURE_zh.md)       |
| 🔧 Tool API Reference        | [TOOLS_zh.md](docs/TOOLS_zh.md)                     |
| 🤖 Smart Assistant Guide     | [SMART_ASSISTANT_zh.md](docs/SMART_ASSISTANT_zh.md) |
| ⚡ Quick Tools Guide         | [QUICK_TOOLS_zh.md](docs/QUICK_TOOLS_zh.md)         |
| 🌐 `/mcp-new` Endpoint Guide | [MCP_NEW_zh.md](docs/MCP_NEW_zh.md)                 |
| 🔍 Troubleshooting           | [TROUBLESHOOTING_zh.md](docs/TROUBLESHOOTING_zh.md) |
| 📋 Changelog                 | [CHANGELOG.md](docs/CHANGELOG.md)                   |
