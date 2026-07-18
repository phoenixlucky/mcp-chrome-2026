# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.5.1] - 2026-07-19

### Added

- **元素代码生成弹窗**: 标记元素后弹窗展示定位代码，替代原有 JSON 文件导出。
  - 🪟 内联代码弹窗 UI，支持一键复制到剪贴板
  - 🌐 支持 JavaScript（querySelector / XPath）和 Python（Selenium By）两种代码格式
  - 📋 使用 Clipboard API + fallback 兼容，确保所有环境下可用
  - ⌨️ Escape 键快捷关闭弹窗
  - 📑 代码标签页切换（JS / Python），复制按钮标题跟随语言同步更新

### Changed

- 所有包版本统一为 v1.5.1

## [v1.5.0] - 2026-07-19

### Breaking

- **工作流引擎 v3 架构统一**: 旧版 record-replay v2 代码已全面迁移至 v3 统一架构。
  - 🧹 移除 v2 旧引擎、旧录制模块、旧节点系统（共 50+ 文件）
  - 🏗️ 动作处理器统一为 `record-replay-v3/actions` 模块
  - 🔌 插件系统重构为 `action-node-adapter` + `register-action-nodes`
  - 📦 新增 `public-api` / `builder-types` / `utils` 公共模块
  - 📉 净减少 ~12,300 行旧代码
  - 📦 v1.5.0 之前的旧版本源码已归档至 `V2toV3` 分支

### Changed

- 所有包版本统一为 v1.5.0

## [v1.4.0] - 2026-07-18

### Added

- **Catgirl assistant persona**: Claude and Codex sessions now use a warm, professional catgirl personality while preserving reliable tool execution.
- **DeepSeek API engine**: OpenAI-compatible streaming chat support via `DEEPSEEK_API_KEY`.
- **Assistant and quick-tool guides**: Added bilingual setup and usage documentation.

### Changed

- **Node 24 SQLite compatibility**: Upgraded `better-sqlite3` to v12 for a compatible native binary.
- **pnpm**: Project now pins pnpm 11.14.0 through Corepack; the root build command works correctly in PowerShell.
- **DeepSeek settings**: API Key and optional Base URL can be set in the extension without returning the key to the UI.

## [v1.3.3] - 2026-07-17

### Added

- **CDP image blocking**: `chrome_block_images` stops future image requests before navigation or reload.

## [v1.3.2] - 2026-07-17

### Fixed

- Content scripts no longer register `unload` listeners, avoiding Permissions Policy errors.
- Startup scripts warn when Chrome locks `app/native-server/dist` during a rebuild.

### Changed

- Operation overlay now shows the target, wait limit, selection range, and expanded/collapsed element name when available.

## [v1.3.1] - 2026-07-16

### Added

- **Operation overlay**: Show the current MCP action in the page bottom-left and highlight its target when available.

### Changed

- Lazy-load scrolling now returns after a paced step so it can be repeated without exceeding short MCP request limits.

## [v1.3.0] - 2026-07-16

### Added

- **CLI `start` command**: New `cli.js start` subcommand to launch the Native Host directly.
- **Auto-derive extension ID**: Native Messaging registration now reads the extension ID from the current Chrome build instead of hard-coding it.
- **Port conflict resolution**: `start-server.bat` and `start-server-npm.bat` automatically kill any existing process on port 12306 before starting.
- **`reasonix.toml`**: Project configuration file for Reasonix agent.
- **`start-server-npm.bat`**: npm-based one-click startup script (alternative to pnpm version).
- **Pop-up UI beautification**: Status banner with colored background, enlarged status dot with glow, SVG warning icon, port input with `127.0.0.1:` prefix, visual grouping of connection controls.
- **Extension ID display**: Pop-up now shows the runtime extension ID and current extension logo.
- **Semantic engine cleanup**: Unused agent-model configurations removed.

### Changed

- Extension icons compressed significantly (e.g. 128.png: 210 KB → 33 KB).
- All release packages bumped to v1.3.0.
- `start-server.bat` now runs `pnpm install` and uses `cli.js start` instead of `dist/index.js`.

### Removed

- `app/native-server/start-server.js`: Superseded by `cli.js start`.

## [v1.2.1] - 2026-07-15

### Added

- **Tool cancellation**: `CANCEL_TOOL` message type for aborting in-flight tool calls. AbortController support in native host and Chrome extension.
- **`stableForMs` for `chrome_wait`**: Require the condition to remain true continuously for N milliseconds before returning (default: 0).
- **`expectedUrl` URL guard**: Write tools (navigate, click, fill, scroll, click_and_wait) accept `expectedUrl` — refuses execution if the target tab URL doesn't match.
- **Active tab resolution**: Write operations auto-resolve the active tab ID before execution.
- **Tool-level dynamic timeouts**: Timeouts tailored per tool type (write/read/navigation/long-running).
- **Per-tab serialization**: Write operations to the same tab are queued sequentially.
- **`getRecentToolCalls()`**: Diagnostic endpoint logging recent tool activity (outcome, timing, errors).

### Changed

- All release packages bumped to v1.2.1.
- `/status` endpoint enhanced with MCP session tracking (`activeSessions`, `activeRequests`, `reclaimedSessions`), NativeHost connection state, and optional `probe` query parameter for end-to-end health check.
- Stale MCP sessions (>10 min idle) are automatically reclaimed every 60s.
- `start-server.bat` version label updated.

### Fixed

- Server test: Added GET /status smoke test.

## [v1.2.0] - 2026-07-15

### Added

- `/status` reports service, MCP session, Native Messaging, extension, and tool availability.
- Per-tab serialization for browser write operations, MCP cancellation forwarding, and stale-session reclamation.
- `stableForMs` for `chrome_wait`.
- `start-server.bat`: One-click startup script for local Native Host.

### Changed

- All release packages bumped to v1.2.0.
- README.md / README_en.md: Professional rewrite with consistent bilingual structure.
- docs/TOOLS_zh.md: Added complete scraping tools documentation (v1.1.0 + v1.1.2 tools).

### Fixed

- Native server: Removed module-level `mcpServer` singleton to avoid state leaks.

## [v1.1.2] - 2026-07-15

### Added

- `chrome_get_page_text`: Extract readable article text, HTML, and metadata with Readability.
- Same-origin iframe support (`frameSelector`) for `chrome_scroll`, `chrome_wait`, and `chrome_extract`.
- `table` extraction mode in `chrome_extract`, including `colspan` and `rowspan` expansion.
- `chrome_click_and_wait`: Click an element, then wait for a target element state.

### Changed

- All release packages bumped to v1.1.2.

## [v1.1.1]

### Fixed

- **Extension ID Calculation**: Fixed incorrect extension ID in native host constant — was using a manually guessed ID, now computes correctly from the extension key. Native messaging connection now works.
- **Extension ID Stability**: Fixed Chrome extension key in `.env.local` so the extension ID no longer changes on reload
- **Native Messaging Registration**: Updated native host manifest with correct extension ID

### Changed

- All packages bumped to v1.1.1

## [v1.1.0]

### Added

- **4 Scraping Tools**: New MCP tools for web scraping and data collection
  - `chrome_get_tab_url`: Lightweight tab URL retrieval (faster than `get_windows_and_tabs`)
  - `chrome_scroll`: Scroll page/container with 4 modes (pixel/edge/element/container auto-detect)
  - `chrome_wait`: Wait for element or JS condition with 6 wait modes (visible/present/hidden/gone/enabled/jsCondition)
  - `chrome_extract`: Extract structured data via CSS selectors with 7 extraction types (text/html/outerHtml/attribute/number/href/src)

## [v0.0.5]

### Improved

- **Image Compression**: Compress base64 images when using screenshot tool
- **Interactive Elements Detection Optimization**: Enhanced interactive elements detection tool with expanded search scope, now supports finding interactive div elements

## [v0.0.4]

### Added

- **STDIO Connection Support**: Added support for connecting to the MCP server via standard input/output (stdio) method
- **Console Output Capture Tool**: New `chrome_console` tool for capturing browser console output

## [v0.0.3]

### Added

- **Inject script tool**: For injecting content scripts into web page
- **Send command to inject script tool**: For sending commands to the injected script

## [v0.0.2]

### Added

- **Conditional Semantic Engine Initialization**: Smart cache-based initialization that only loads models when cached versions are available
- **Enhanced Model Cache Management**: Comprehensive cache management system with automatic cleanup and size limits
- **Windows Platform Compatibility**: Full support for Windows Chrome Native Messaging with registry-based manifest detection
- **Cache Statistics and Manual Management**: User interface for viewing cache stats and manual cache cleanup
- **Concurrent Initialization Protection**: Prevents duplicate initialization attempts across components

### Improved

- **Startup Performance**: Dramatically reduced startup time when no model cache exists (from ~3s to ~0.5s)
- **Memory Usage**: Optimized memory consumption through on-demand model loading
- **Cache Expiration Logic**: Intelligent cache expiration (14 days) with automatic cleanup
- **Error Handling**: Enhanced error handling for model initialization failures
- **Component Coordination**: Simplified initialization flow between semantic engine and content indexer

### Fixed

- **Windows Native Host Issues**: Resolved Node.js environment conflicts with multiple NVM installations
- **Race Condition Prevention**: Eliminated concurrent initialization attempts that could cause conflicts
- **Cache Size Management**: Automatic cleanup when cache exceeds 500MB limit
- **Model Download Optimization**: Prevents unnecessary model downloads during plugin startup

### Technical Improvements

- **ModelCacheManager**: Added `isModelCached()` and `hasAnyValidCache()` methods for cache detection
- **SemanticSimilarityEngine**: Added cache checking functions and conditional initialization logic
- **Background Script**: Implemented smart initialization based on cache availability
- **VectorSearchTool**: Simplified to passive initialization model
- **ContentIndexer**: Enhanced with semantic engine readiness checks

### Documentation

- Added comprehensive conditional initialization documentation
- Updated cache management system documentation
- Created troubleshooting guides for Windows platform issues

## [v0.0.1]

### Added

- **Core Browser Tools**: Complete set of browser automation tools for web interaction

  - **Click Tool**: Intelligent element clicking with coordinate and selector support
  - **Fill Tool**: Form filling with text input and selection capabilities
  - **Screenshot Tool**: Full page and element-specific screenshot capture
  - **Navigation Tools**: URL navigation and page interaction utilities
  - **Keyboard Tool**: Keyboard input simulation and hotkey support

- **Vector Search Engine**: Advanced semantic search capabilities

  - **Content Indexing**: Automatic indexing of browser tab content
  - **Semantic Similarity**: AI-powered text similarity matching
  - **Vector Database**: Efficient storage and retrieval of embeddings
  - **Multi-language Support**: Comprehensive multilingual text processing

- **Native Host Integration**: Seamless communication with external applications

  - **Chrome Native Messaging**: Bidirectional communication channel
  - **Cross-platform Support**: Windows, macOS, and Linux compatibility
  - **Message Protocol**: Structured messaging system for tool execution

- **AI Model Integration**: State-of-the-art language models for semantic processing

  - **Transformer Models**: Support for multiple pre-trained models
  - **ONNX Runtime**: Optimized model inference with WebAssembly
  - **Model Management**: Dynamic model loading and switching
  - **Performance Optimization**: SIMD acceleration and memory pooling

- **User Interface**: Intuitive popup interface for extension management
  - **Model Selection**: Easy switching between different AI models
  - **Status Monitoring**: Real-time initialization and download progress
  - **Settings Management**: User preferences and configuration options
  - **Cache Management**: Visual cache statistics and cleanup controls

### Technical Foundation

- **Extension Architecture**: Robust Chrome extension with background scripts and content injection
- **Worker-based Processing**: Offscreen document for heavy computational tasks
- **Memory Management**: LRU caching and efficient resource utilization
- **Error Handling**: Comprehensive error reporting and recovery mechanisms
- **TypeScript Implementation**: Full type safety and modern JavaScript features

### Initial Features

- Multi-tab content analysis and search
- Real-time semantic similarity computation
- Automated web page interaction
- Cross-platform native messaging
- Extensible tool framework for future enhancements
