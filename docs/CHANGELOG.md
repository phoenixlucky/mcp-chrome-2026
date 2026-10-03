# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **English-first project** — code comments, UI strings, documentation, and the README are now English; English is the default UI language. The canonical tool catalog in `tools.ts` is English, while `tools-zh.ts` keeps the Chinese descriptions the extension zh mode reads.

## [v2.7.6] - 2026-09-13

### Added

- **Background window browser operations** — Improved scrolling, collection, thread extraction, and page interaction with minimized windows, plus explicit foreground-window requirements and retryable errors.
- **Collection and scroll tool enhancements** — Support for background mode, layout availability detection, partial results, and a unified scroll execution path.

### Fixed

- **Browser tool stability** — Improved CDP timeouts, page lifecycle, network capture, SPA requests, and cross-page result handling.
- **Version sync** — Root package, sub-packages, WASM, and desktop Tauri/Cargo configs aligned to v2.7.6.

## [v2.7.5] - 2026-09-13

### Added

- **Content script timeout recovery and execution state protection** — Content script timeouts support one recovery retry; side-effect actions such as clicks return `EXECUTION_UNKNOWN` after a timeout to avoid blind re-execution.

### Fixed

- **Browser interaction cancellation and disconnects** — Improved cancellation and error diagnostics when clicks, keyboard input, scrolling, CDP sessions, and HTTP requests are aborted.
- **Version sync** — Root package, sub-packages, WASM, and desktop Tauri/Cargo configs aligned to v2.7.5.

## [v2.7.4] - 2026-09-13

### Added

- **Recursive page collection and thread extraction** — Added `chrome_crawl_links` and `chrome_extract_thread` with depth/node limits, retries, scroll loading, nested filtering, and conditional stopping.

### Fixed

- **Inspection tool error messages** — Preserve page execution exception descriptions and stacks to help pinpoint `find_and_click` and `expand_section` failures.
- **Version sync** — Root package, sub-packages, WASM, and desktop Tauri/Cargo configs aligned to v2.7.4.

## [v2.6.11] - 2026-09-08

### Fixed

- **More robust output sanitization** — Improved extension output sanitization logic with added tests to reduce malformed or incomplete responses.

### Changed

- All release packages, desktop Tauri config, and runtime versions aligned to v2.6.11.

## [v2.6.10] - 2026-09-07

### Added

- **Recent request record collapsing and scrolling** — Desktop completed-call records can now be collapsed and scroll independently when there are many entries.

### Fixed

- **Slow-page navigation no longer blocks** — `chrome_navigate` no longer waits for the page to be fully ready by default; timeout errors are normalized to `McpToolTimeout` so subsequent URL/HTML polling can continue.

### Changed

- All release packages, desktop Tauri config, and runtime versions aligned to v2.6.10.

## [v2.6.9] - 2026-09-07

### Fixed

- **Waits hanging while a page keeps loading** — `chrome_wait`'s CDP wait now supports a local deadline, cancellation, and debugger session release.
- **Stale tabId silently reused** — When an explicit tab is closed, `chrome_block_images` now returns a clear error instead of switching to the active tab.
- **Same-tab request queue blocking** — The write-operation queue now supports deadlines and cancellation so later requests aren't held hostage by a stuck operation.
- **Multiple-match selector diagnostics** — A caller selector matching multiple elements is now reported as an expected input error, suggesting a more specific selector.

### Changed

- All release packages, desktop Tauri config, and runtime versions aligned to v2.6.9.

## [v2.6.7] - 2026-09-04

### Added

- **All-entry request monitoring and abort** — The desktop app now shows active requests across `/mcp`, `/mcp-new`, `/sse`, and STDIO, and can abort by request ID.
- **Page message timeout configuration** — Extension settings support manual configuration from 5–300 seconds, default 30 seconds.

### Fixed

- **`/mcp-new` deadline too short** — Extended native request windows for regular tools, long tasks, and tab resolution to reduce intermittent `DEADLINE_EXCEEDED`.

### Changed

- All release packages, desktop Tauri config, and runtime versions aligned to v2.6.7.

## [v2.5.6] - 2026-09-04

### Fixed

- **`/mcp-new` large-response failures** — Fixed Artifact responses missing the regular tool `status` field being misreported as `Error calling tool: undefined`.
- **Extension content script disconnects** — When the receiver doesn't exist or the message channel is closed, `getHtmlContent` / `getInteractiveElements` now wait for the tab to be ready, re-inject, and retry once.

### Added

- **Sessionless request monitoring and abort** — The desktop app shows active `/mcp-new` requests with request ID, tool name, duration, and client info, and can abort by request ID.
- **Error response fallback** — Preserve the error object, message, or status when the native extension returns a non-success response, avoiding lost error context.

### Changed

- All release packages, desktop Tauri config, and runtime versions aligned to v2.5.6.

## [v2.5.5] - 2026-09-03

### Added

- **Unified transport layer** — Added `unified-transport` and `stdio-transport`: the STDIO client connects to `/mcp-new` (MCP 2026-07-28 sessionless transport) by default and falls back to the compatible `/mcp` when that fails; JSON-RPC encoding/decoding, deadlines, cancellation, retries, error mapping, and newline JSON / `Content-Length` dual framing are consistent across the whole chain.
- **Native channel concurrency control and protocol V2 consolidation** — After a Native Host disconnect, pending / controller / queue are reset to zero and write operations are not replayed automatically; V1 input is rejected with `UNSUPPORTED_VERSION`; added a frame decoder (16 MiB per-message limit, half/sticky packet reassembly, per-read count limit).
- **Shared protocol extensions** — `native-protocol` adds Artifact chunk messages (`artifactId + seq + eof + sha256`) and the `native.eventChannelReady` event, extending capability declarations.
- **Artifact data plane** — Added `artifact-store`: chunked upload and verification, atomic rename of temp files, TTL auto-cleanup with a size cap, and cleanup of disconnected-session leftovers; Cookie / Token / Authorization are redacted.
- **localhost WebSocket event channel** — Added `event-websocket-server`: random port with one-time token issuance, 127.0.0.1-only binding, Origin / extension ID allowlists, and connection-count and request-size limits.
- **Security and observability** — Support for an exact extension ID (`CHROME_MCP_EXTENSION_ID`) and Origin allowlist (`CHROME_MCP_ALLOWED_ORIGINS`), request body cap `CHROME_MCP_MAX_HTTP_BODY_BYTES` (default 8 MiB), and debug start/stop endpoints disabled by default (`CHROME_MCP_ENABLE_DEBUG_ENDPOINTS`); per-request traceId with segment timings for `stdio_wait` / `http_process` / `native_queue_wait` / `native_roundtrip` / `browser_execution` / `total`.
- **Release gates** — Added `test:phase8` / `check:phase8` and `scripts/phase8-gates.mjs` (1000 mixed read/write operations, disconnect reset, static gates); `check-versions` now covers desktop Tauri / Cargo / tauri.conf.
- **Browser and tool enhancements** — `navigate` supports `waitForReady` / `waitTimeoutMs`; idle reclamation protection for spa fetch temporary tabs; popup supports switching between multiple transport entry configurations.

### Changed

- `/mcp-new` is now the default endpoint (stdio default config and CLI docs synced), with `/mcp` kept as a compatible endpoint; the legacy SSE `/sse` + `/messages` and STDIO entries are also retained.
- The desktop app shows all MCP service entries, with new connection-type / sessionless endpoint stats, session P95 duration, and client details (duration / latency / list popup).
- Native STDIO framing accepts both newline JSON and `Content-Length`; stdio client connections gained concurrency protection and stale reset.
- Packaging scripts support per-target build selection; packaging artifacts were slimmed down, pnpm unified at 11.25, and the desktop icon switched to the local icon.ico.
- Versions aligned to v2.5.5.

## [v2.5.0] - 2026-09-02

### Added

- **Streamable HTTP (early preview)** — Added `/mcp-new` providing the MCP 2026-07-28 sessionless transport.
- **Multiple transport entries coexist** — The compatible `/mcp`, legacy SSE `/sse` + `/messages`, and STDIO entries are retained.
- **Desktop entry panel** — `chrome-mcp-desktop-2.5.0-win-x64` shows all MCP service entries.

### Changed

- **Versions aligned to v2.5.0** — Root package, sub-packages, Tauri/Cargo, portable runtime, and desktop manager upgraded together.

## [v2.4.11] - 2026-08-31

### Added

- **Tauri 2 + Vue desktop client** — Added `app/desktop-client`: a native desktop manager (Rust + Vue) with Windows packaging (NSIS/MSI), icon, and tray integration.
- **Portable single-file EXE** — `scripts/package-windows.mjs` builds `chrome-mcp-bridge-<ver>-win-x64.exe` on Node SEA + postject, embedding the full runtime and auto-registering Chrome/Chromium Native Messaging.
- **Desktop manager and tray residency** — WinForms status panel (service/extension/Native Host/MCP sessions/tool count), closing the window minimizes to the system tray, with start/stop service, health check, and log entry; `--stdio` portable mode can be used directly as an MCP client command.
- **One-click packaging scripts** — `package-windows.bat` / `package-desktop-windows.bat` validate version consistency before packaging.

### Changed

- **Service toggle and status control channel** — `/__chrome_mcp_bridge/start` and `/stop` control endpoints; when the service is stopped, endpoints such as `/mcp` return 503 while the local control channel stays available.
- **HTTP port takeover** — The Chrome native messaging host can take over an occupied port at startup, keeping the extension connection and HTTP service in the same process.
- **Proxy rotation IP comparison** — Manual rotation shows the exit IP before and after the switch, temporarily overriding the probe session during detection.
- **Icon and packaging improvements** — Desktop client/manager use the catgirl icon with EXE resource injection (`UpdateResource`); documentation/config source files are skipped and locked release files fall back to `.new.exe`; pnpm bumped to 11.24.0 and packaging switched to tar zip.
- Versions aligned to v2.4.11.

## [v2.4.10] - 2026-08-26

### Added

- **Theme visual upgrade** — Premium character art backgrounds across the app: Popup / Sidepanel / Welcome / Builder page cards are transparentized and blended with the background image (`color-mix` translucent material, `center top` composition fix).
- **`better-sqlite3` upgraded to `^13.0.3`** — Migrated to N-API with bundled prebuilt binaries for all platforms; installation no longer requires compiling from source.

### Fixed

- **IDBFS sync race fix** — Wait for the sync callback to complete before continuing, avoiding an IDBFS sync race (`vector-database.ts`).
- **Content indexing tasks deduplicated per tab** — Index tasks for the same tab reuse the in-flight Promise to avoid duplicate concurrent indexing; improved error handling (`content-indexer.ts`).

### Changed

- Fixed CI `check:versions`; package versions aligned to 2.4.10.
- Versions aligned to v2.4.10.

## [v2.4.4] - 2026-08-26

### Changed

- **New theme background across multiple pages** — Popup non-home views (MCP tools page / local model page) use the catgirl character art background with translucent frosted-glass cards overlaid; the Sidepanel uses a full-bleed catgirl background; Welcome page cards and the command-line block switched to translucent `color-mix` material blended with the cover background; Builder Canvas and the Popup home background composition fixed to `center top` so the header art isn't cropped; the Popup home main card now uses the chat background image to distinguish it from the sidepanel.
- Versions aligned to v2.4.4.

## [v2.4.3] - 2026-08-26

### Added

- **Catgirl theme asset update** — Replaced the full extension icon set (16–128px), chat background, and character art, added a Welcome page-exclusive background image, and switched the Welcome page to a full-bleed cover layout.

### Changed

- **`better-sqlite3` upgraded to `^13.0.3`** — v13 migrates to N-API with bundled prebuilt binaries for all platforms (upstream removed the unmaintained `prebuild-install` dependency), so installation no longer needs source compilation or Node headers download; the pnpm `allowBuilds` exception for `better-sqlite3` was removed accordingly. The `--allow-scripts` allowlist in the install command dropped `better-sqlite3` as well.
- Installation docs (README / README_en / WINDOWS_INSTALL_zh) updated accordingly.
- Versions aligned to v2.4.3.

## [v2.4.2] - 2026-08-25

### Fixed

- **FS.syncfs serialization** — All `syncFS` requests are queued and run serially; a timeout (5s) only logs a `console.warn` instead of releasing the queue early, preventing concurrent syncfs races from corrupting vector store files (`vector-database.ts`).
- **Cleanup flow reuses the sync queue** — Vector store cleanup/initialization now reuses the same sync queue to avoid interleaving with write operations.
- **Prevent duplicate tab event listeners** — The content indexer adds a `tabEventListenersSetUp` flag to avoid registering listeners repeatedly across multiple initializations (`content-indexer.ts`).
- **Vector search disables duplicate auto-indexing** — The vector search tool's `autoIndex` now defaults to `false` to avoid double indexing with the content indexer (`vector-search.ts`).

### Changed

- Versions aligned to v2.4.2.

## [v2.4.1] - 2026-08-25

### Changed

- **Native stdio direct connection (no extra bridge)** — `mcp-chrome-stdio` now uses the MCP SDK's Streamable HTTP client internally, managing POST, SSE, and `sessionId` lifecycle automatically; native stdio is recommended and `mcp-bridge.js` is no longer required.
- **`MCP_SERVER_URL` / `MCP_SERVER_ORIGIN` configuration** — New environment variables: `MCP_SERVER_URL` sets the Streamable HTTP endpoint the stdio client connects to (default `http://127.0.0.1:12306/mcp`); `MCP_SERVER_ORIGIN` customizes the Origin (default `chrome-extension://mcp-stdio`).
- **API key forwarding** — When the service enables `CHROME_MCP_API_KEY`, the stdio client automatically forwards the key as a Bearer token to the HTTP server.
- The local bridge now sends Origin automatically, improving handshake compatibility.
- Versions aligned to v2.4.1.

## [v2.4.0] - 2026-08-25

### Added

- Optional `CHROME_MCP_API_KEY` protection for HTTP and SSE MCP endpoints.
- Tool scopes via `CHROME_MCP_ALLOWED_TOOLS` and high-risk approval via `CHROME_MCP_REQUIRE_APPROVAL` / `CHROME_MCP_APPROVED_TOOLS`.
- Public `chrome_userscript` schema, documentation, and catalog entry.
- Opt-in real Chrome smoke test via `pnpm test:chrome-smoke`.
- Tool documentation coverage check via `pnpm check:tool-docs`.
- Version consistency check via `pnpm check:versions`.

### Fixed

- **Image blocking false positives fixed** — Fixed image blocking rules accidentally blocking legitimate image requests; fill and element lookup logic is more robust (v2.3.6).

### Changed

- STDIO tool discovery now mirrors the upstream HTTP catalog, including dynamic flow tools.
- MCP HTTP requests without an Origin now require a valid API key; invalid Origins are rejected.
- Web Editor is V3-only; the unused V1 fallback path and legacy script were removed.
- Obsolete commented legacy schema drafts were removed; userscript is now a documented public tool.
- CI: build the shared package before typecheck; fixed `--` separator argument passing for pnpm test commands; upload-artifact fixed zips in the hidden `.output` directory.
- Package versions are aligned at v2.4.0.

## [v2.3.5] - 2026-08-24

### Changed

- **web-editor v2 → v3 architecture migration** — Web Editor components fully migrated to the v3 unified architecture: message actions updated from the v2 suffix to the v3 suffix, the `window`-exposed API renamed to `__MCP_WEB_EDITOR_V3__`, and type definitions and comments synced.
- **CI workflow** — Added `.github/workflows/ci.yml` (triggered on master push / PR; typecheck + lint + test + build) and cleaned up `build-release.yml`.
- **wasm-simd enhancements** — Added `description` / `license` to the Rust package and new helper scripts: `copy-wasm.mjs` (COPY helper) and `check-wasm-toolchain.mjs` (Rust toolchain check).
- **Windows install troubleshooting** — Windows install docs gained an EBUSY directory-lock troubleshooting guide.
- Versions aligned to v2.3.5.

## [v2.3.1] - 2026-08-24

### Added

- **7 page tools** — Added `chrome_create_tab` (specify URL/window/foreground or background/pinned), `chrome_hover` (element hover), `chrome_print_to_pdf` (PDF export on A3-A5/LETTER/LEGAL/TABLOID paper), `chrome_get_element_info` (element geometry and property inspection), and `chrome_storage_get` / `chrome_storage_set` / `chrome_storage_delete` (extension storage read/write/delete).
- **Welcome page Chinese/English toggle** — Auto-detects language, persists the choice to `localStorage`, and syncs `<html lang>` and `<title>`.

### Changed

- Versions aligned to v2.3.1.

## [v2.3.0] - 2026-08-24

### Added

- **Multi-profile task isolation** — Isolated cookies, cache, history, and login state with parallel multi-session support.
- **Profile diagnostics** — Aggregated profile, CDP, MCP, proxy, and extension status.
- **Batch and scheduled tasks** — Added `chrome_batch` with persistent workflow queues and cron/interval triggers.
- **Safe upgrade command** — Exact versions, npm SHA-512 integrity verification, install verification, and rollback on failure.

### Changed

- **Unified ActionPolicy** — Click, type, scroll, and navigate actions all support `fast`, `balanced`, and `human` pacing.
- Versions aligned to v2.3.0.

## [v2.2.1] - 2026-08-23

### Added

- **Welcome page Chinese/English toggle** — Detects the UI language from the browser locale, persists the choice to `localStorage`, and syncs `<html lang>` and the page `<title>` (new `locale.ts` with tests).

### Fixed

- **Hardened Native Host shared-runtime installation** — Build scripts verify `dist` is ready before embedding the shared runtime, with a clear error and fix guidance when missing; `doctor` gained a `host.shared-runtime` check that auto-restores the runtime into `node_modules` when a vendor copy exists; `postinstall` prints a clear warning when the runtime is missing instead of a `MODULE_NOT_FOUND` on first launch.

### Changed

- Versions aligned to v2.2.1.

## [v2.2.0] - 2026-08-21

### Added

- **Proxy session management system** — Reworked `proxy.ts`: multi-country proxy selection (`PROXY_COUNTRIES`), per-session rotation (`sessionIdsByScope`), default session duration of 5 minutes, explicit rotation window (max 3 per 60s), and auto-rotation cooldown (5 minutes per 1-hour window); session ID generation supports the combined `sessid` / `sesstime` format.
- **Popup proxy settings UI** — Greatly expanded proxy configuration UI (country selection, session management entry) with matching Options page enhancements.

### Changed

- **`ensure-pnpm.bat` script** — Added `scripts/ensure-pnpm.bat`; `start-server.bat` and `package-extension.bat` now share the same pnpm/corepack detection logic.
- Proxy tests updated to cover the new session management logic.
- Versions aligned to v2.2.0.

## [v2.1.5] - 2026-08-15

### Fixed

- **Network request tool hardening** — `chrome_network_request` filters browser-forbidden headers (`accept-encoding` / `host` / `origin` / `sec-*`, etc.) to avoid Chrome request validation failures; added same-origin checks and clearer error messages.
- **Web fetcher error handling** — Returns structured errors and retry hints when fetching fails.
- **Legacy locator support** — click/fill fall back to legacy `ref`/`name` locators when a ref is stale and no selector is available; `get_page_text` and other tools updated accordingly.

### Changed

- **start-server.bat enhancement** — Auto-detects pnpm / corepack (falls back to `corepack pnpm` when pnpm is missing), consistent with `package-extension.bat`.
- Minor Popup UI and network helper tweaks; added network-request / web-fetcher / interaction-helper tests.
- Versions aligned to v2.1.5.

## [v2.1.1] - 2026-08-15

### Changed

- **Node 24 requirement** — Project engines and `.nvmrc` now pin Node 24; `start-server.bat` / `start-server.sh` auto-switch to or prompt for Node 24 on startup (nvm preferred).
- **Jest config fix** — native-server test config fixed NodeNext module resolution (`extensionAlias` / `moduleNameMapper`) so builds and tests run reliably on Node 24.
- Versions aligned to v2.1.1.

## [v2.1.0] - 2026-08-14

### Added

- **Target tab resolution rework (`resolveTargetTab`)** — An explicit `tabId` is authoritative: a closed/missing target tab now errors clearly instead of silently falling back to an unrelated active tab; when `tabId` is omitted, `windowId` can select the target window.
- **click/fill target recovery (stale ref recovery)** — The original CSS/XPath selector is kept as a companion locator for the ref; when frameworks like React rebuild DOM nodes and the ref goes stale, the content script re-resolves the target via the selector; the background layer gained a RESOLVE_REF selector lookup so ref-only calls get a recovery hint before dispatch; click/fill helpers accept XPath selectors.
- **Read tools accept a `url` navigation parameter** — When `url` is provided, `read_page` / `spa_fetch` and others navigate first and then read the target tab; `background` can open it in the background.
- **`maxOutputBytes` output limit** — Caps the returned JSON size (default 24000, max 200000); over-limit responses include truncation metadata.
- Added `base-browser.test.ts` (target resolution and recovery tests).

### Changed

- Versions aligned to v2.1.0.

## [v2.0.3] - 2026-08-13

### Added

- **`chrome_paste_image` tool** — Pastes a local image or image data into textarea / input / contenteditable elements as a synthetic paste event; does not read the system clipboard, using a temporary file input, DataTransfer, and ClipboardEvent internally.
- **`chrome_get_form_value` tool** — Reads the current value of a form element for form automation flows.

### Changed

- **`chrome_javascript` target tab improvement** — When `tabId` is omitted, prefer the most recently operated tab and only use the active tab when there is no prior target.
- Improved robustness of file upload / table extraction / click and fill helpers (click-helper / fill-helper).
- Added launch dates for 6 tools in the Popup tool catalog.
- Versions aligned to v2.0.3.

## [v2.0.2] - 2026-08-13

### Added

- **`chrome_locate_element`** — Page element locator: supports saved `markerId`/`markerName`, legacy `ref`, CSS/XPath, visible text, ARIA role, `aria-label`, `data-testid`, and form `name` locators; auto-scrolls to and highlights the target, returning a currently valid `ref`/`selector`/coordinates that can be passed directly to `chrome_click_element` or `chrome_fill_or_select`.
- **`chrome_select_all_items`** — Safe select-all for lazy/virtual lists: scrolls to the bottom, waits until the card count is stable for several consecutive rounds, then toggles each card checkbox individually, without relying on a page's potentially broken "select all" button and without treating optimistic DOM counts as success.

### Changed

- **`chrome_wait_for_extract_response` enhancements** — Added a `confirm` parameter (optionally clicks a confirm button); returns HTTP status, request body, and response body to verify that async operations such as deletes actually succeeded; `extract` is now optional and only needed when extracting JSON records.
- **`chrome_click_element` enhancements** — Supports `markerId`/`markerName` and re-locates the target before clicking.
- **`chrome_javascript` doc fix** — Clarified that the parameter is `code` (not `script`) and that results must be explicitly `return`ed.
- Versions aligned to v2.0.2.

## [v2.0.1] - 2026-08-13

### Changed

- **Restricted page injection protection** — `BaseBrowserToolExecutor.injectFiles` checks the tab URL scheme before injecting and raises a clear error for restricted pages such as `chrome:` / `edge:` / `devtools:` / `view-source:`, replacing Chrome's cryptic underlying rejection.
- **Strict keyboard parameter validation** — `chrome_keyboard`'s `keys` parameter is validated at runtime to be a non-empty string, rejecting invalid types such as arrays/objects passed via MCP.
- **Click helper enhancements** — `click-helper` waits for the target element to become visible before clicking; invisible elements automatically promote to a clickable ancestor (`button` / `[role="button"]` / `a` / `[data-testid]`).
- **Fill helper enhancements** — `fill-helper` handles off-screen renderable candidates before hit testing to avoid hitting the wrong element.
- Versions aligned to v2.0.1.

## [v2.0.0] - 2026-08-12

### Changed

- **CDP session management rework** — Added a per-tab serial lock for each tab's `attach` / `detach` / `sendCommand`, eliminating concurrent session conflicts caused by two tool calls racing between `getTargets()` and `debugger.attach()`; the owner map changed from a `Set` to a reference-counted `Map`, fixing session leaks where repeated references from the same owner released the detach early.
- **`chrome_javascript` cancellation support** — Tool execution is wired to `AbortSignal`: after caller cancellation or timeout, the new `cdpSessionManager.abortOwner()` actively calls `debugger.detach()` to release the leftover session (1s timeout fallback), preventing a hung `Runtime.evaluate` from holding the tab debugger and cascading into later tool stalls; the error contract gained a `cancelled` kind.
- **Regression tests** — Added `cdp-session-manager.test.ts` (concurrent attach serialization, forced release on timeout, balanced owner reference counting) and a cancellation contract test for `chrome_javascript`.
- Versions aligned to v2.0.0.

## [v1.9.2] - 2026-08-10

### Added

- **`chrome_paste_text` tool** — Synthesizes multi-paragraph paste into rich text editors, specifically for Draft.js-based editors (Zhihu, Medium, etc.): dispatches a synthetic `ClipboardEvent('paste')` with `DataTransfer` to the editor element, going through the native paste path so all paragraphs arrive intact, without relying on page focus or reading the system clipboard; replaces `chrome_computer` type (mangles newlines), `execCommand('insertText')` (keeps only the last paragraph), and the clipboard API (rejected without focus). Suggest refreshing the page after pasting to verify the draft is intact before clicking the publish button.

### Changed

- Versions aligned to v1.9.2.

## [v1.9.1] - 2026-08-10

### Added

- **`chrome_post_to_x` tool** — Posts a text post on a logged-in X/Twitter page: waits for the editor, fills and reads back to verify, waits for the publish button, clicks once, and waits for the success marker; explicitly returns `published` / `failed` / `unknown`, and on unknown **does not auto-retry** to avoid duplicate posts; supports custom selectors for X page variants.

### Changed

- **`chrome_handle_dialog` enhancements** — Supports `tabId` / `windowId` to target a tab; covers `beforeunload` dialog handling.
- Refined interaction tools (click/fill helpers, wait).
- Versions aligned to v1.9.1.

## [v1.9.0] - 2026-08-10

### Added

- **`collect_virtual_lists` tool** — **Concurrently** collects dynamic/virtual lists across multiple tabs or windows, returning per-target results, status, batched data, and failure reasons; supports field mapping, dedup, duration caps, batched returns, and progress reporting.

### Changed

- **`chrome_scroll` human-like scroll interval no longer scales with distance** — Fixed `intervalMs` and `steps` both scaling with amount and making total duration grow quadratically; step count still scales with distance from the `600px = 15` steps baseline while the step interval stays constant (human / humanFast / humanSlow = 50 / 20 / 80ms), so long human-like scrolls now scale linearly with distance; tool description and docs updated.
- **MCP live progress pipeline** — Long-running collection tools can report incrementally via Native Messaging `tool_progress` messages, converted to standard `notifications/progress`; the final result protocol stays compatible and cancellation and multi-window progress keep reusing the same request context.
- Versions aligned to v1.9.0.

## [v1.8.4] - 2026-08-04

### Fixed

- **i18n tool parameter description fix** — Added tool-level description overrides for 26 parameters, fixing generic parameter descriptions (`query` / `text` / `tabIds` / `tabId` / `url` / `action`, etc.) bleeding into unrelated tools (e.g. `search_tabs_content.query` wrongly showing bookmark keywords).
- **`chrome_scroll.mode` / `chrome_console.mode` description fix** — The generic `mode` entry had console-specific semantics and showed wrong text for `chrome_scroll.mode`; both tools now have their own tool-level descriptions and the generic entry was made neutral.

### Changed

- Versions aligned to v1.8.4.

## [v1.8.9] - 2026-08-06

### Fixed

- **`chrome_scroll` human-like lazy-load performance** — Only one page settle wait per pacing round instead of after every small step, avoiding MCP request budget overruns; long human-like scrolls are more stable and efficient.

### Changed

- Minor Popup tool page tweaks.
- Versions aligned to v1.8.9.

## [v1.8.8] - 2026-08-04

### Changed

- **`chrome_scroll` human-like speed tiers sped up** — The three tiers' base intervals changed to `human` 50ms / `humanFast` 20ms / `humanSlow` 80ms (previously 100/50/150ms), roughly doubling scroll efficiency; tool description and docs updated.
- **`package-extension.bat` enhancement** — Auto-detects pnpm / corepack (falls back to `corepack pnpm` when pnpm is missing); the shared build now uses `--filter`.
- Versions aligned to v1.8.8.

## [v1.8.7] - 2026-08-04

### Added

- **`chrome_scroll` human-like speed tiers** — `human`, `humanFast`, and `humanSlow` use 50ms, 20ms, and 80ms step intervals respectively, covering more dynamic page scenarios together with `humanLazyLoad` / `toBottom`; tool description and docs updated.

### Changed

- Versions aligned to v1.8.7.

## [v1.8.6] - 2026-08-04

### Added

- **Dynamic MCP Server version** — The stdio / HTTP server version now reads `package.json` instead of the hard-coded `1.0.0`, so clients can accurately detect the extension version.

### Fixed

- **i18n fix** — Corrected the `chrome_scroll` `mode` parameter description; added tool-level parameter descriptions to avoid generic copy mismatches; aligned the Chinese Popup MCP tool catalog translation with README_zh.

### Changed

- Simplified tool timeout logic: a uniform 60s cap for non-long-running tools (removed the separate navigate/download/upload categories).
- Versions aligned to v1.8.6.

## [v1.8.1] - 2026-08-04

### Added

- **`chrome_scroll` human-like scroll mode (`mode: 'human'`)** — Brand-new human-behavior-simulating scroll:
  - Scrolls pixel by pixel using **native wheel input** instead of setting scrollTop directly, triggering real page scroll listeners
  - Advances in steps (600px per step, 150ms interval) with an **ease-out curve** to mimic human wheel pacing
  - `humanLazyLoad: true`: checks DOM, layout, and network resource changes after each small step and waits for the page to settle before continuing (800ms timeout); combined with `toBottom` it keeps loading infinite lists (max 50 rounds / 9 second cap)
- Scroll tool description and parameters completed, with matching tests.

### Changed

- Versions aligned to v1.8.1.

## [v1.8.0] - 2026-07-31

### Added

- **`chrome_proxy_rotate` tool** — Rotates the proxy session and reloads the page when the caller confirms the tab is misbehaving (requires an enabled proxy; never returns username or password).
- **English tool descriptions** — Added full English tool descriptions in `tools-en.ts`, completing bilingual metadata coverage.
- **Scroll tool enhancements** — Extended scrolling capabilities (element scroll, direction control, timeout handling, etc.).
- **Web Editor performance monitoring update** — Enhanced `perf-monitor` and message listeners, with matching tests.

### Changed

- Versions aligned to v1.8.0.

## [v1.7.16] - 2026-07-31

### Added

- **Proxy support** — Added proxy setup/management: new proxy configuration UI in the Options and Popup pages with proxy takeover status control.
- **`chrome_proxy_diagnostics` tool** — Reads proxy config and Chrome takeover status; with `action=test` it verifies the proxy exit IP (never returns username or password).
- **Network request proxy support** — The `network-request` tool works in proxied environments, with matching tests.

### Changed

- Versions aligned to v1.7.16.

## [v1.7.5] - 2026-07-31

### Fixed

- **Cookie tool fix** — Filters tool metadata (`intent`/`background`) before calling the `chrome.cookies` API, avoiding parameter pollution that broke operations.
- **Popup App fix** — Adjusted error prompts and popup UI.
- **Error log fix** — Improved `error-log.ts` output.

### Changed

- Versions aligned to v1.7.5.

## [v1.7.0] - 2026-07-31

### Added

- **`collect_virtual_list`** — Reliably extracts deduplicated records from dynamic/virtual lists with small-step scrolling, stall detection, and upward rescans.
- **`wait_extract_response`** — Waits for a specific JSON response after navigation or a click and extracts records via JSONPath.
- **`capture_debug_bundle`** — Saves the failure scene to the downloads directory: screenshot, DOM, console, redacted network summary, and metadata.
- **`resume_tab_task`** — Saves, reads, or clears caller state for a normal tab (doesn't create an incognito window or read cookies).

### Changed

- Native Host: MCP SDK upgraded to `^1.30.0`, `drizzle-orm` to `^0.45.2`; fixed and improved `native-messaging-host` request ID generation, `file-handler`, and the `doctor` script.
- Minor tweaks to the Popup tool page and DeepSeek settings panel.
- All project package versions aligned to v1.7.0.

## [v1.6.26] - 2026-07-31

### Added

- **12+ new tools** — `chrome_block_resources` (block resource loading), `chrome_task_context` (task context), `chrome_scoped_action` (scoped action), `chrome_diagnostic_snapshot` (diagnostic snapshot), `chrome_list_frames` (list frames), `chrome_find_and_click` (find and click), `chrome_expand_section` (expand collapsed section), `chrome_scan_for_section` (scroll to find section), `chrome_paginate_extract` (paginated extract), `chrome_extract_records` (extract records), `detect_empty_state` (detect empty state), `merge_records` (merge records).
- **Network capture rework** — Unified the webRequest / CDP channels and added the upgraded `chrome_block_images` resource control.
- **Popup tool page update** — Improved MCP tool list interaction and presentation.

### Changed

- Fixed and improved the Agent Chat component.
- Added an assistant UI screenshot to the README.
- Versions aligned to v1.6.26.

## [v1.6.19] - 2026-07-30

### Added

- **Sidepanel chat UI overhaul** — Catgirl chat background, i18n support, theme switching, and settings panel rework.
- **Selector engine overhaul** — Added page handler, greatly optimized the `element-marker.js` injection script, and improved many Builder/Sidepanel experiences.
- **Popup page adjustments** — Improved tool list interaction.
- Added the `package-extension.bat` packaging script.

### Changed

- Semantic similarity engine now statically imports PREDEFINED_MODELS; wxt config disables modulePreload.
- DeepSeek engine updated with added tests.
- Versions aligned to v1.6.19.

## [v1.6.4] - 2026-07-30

### Added

- **Cookie management trio** — Added `chrome_cookie_get` / `chrome_cookie_set` / `chrome_cookie_delete` for querying, setting, and deleting cookies filtered by URL, domain, or name.
- **`chrome_get_interactive_elements`** — Restored (it had been missed).
- Removed `start-server-npm.bat` (duplicate of `start-server.bat`).
- README roadmap update: removed "tool-level ACL" and added a "planned tools" table.

### Changed

- Versions aligned to v1.6.4.

## [v1.6.2] - 2026-07-30

### Added

- pnpm bumped to 11.18.0.

## [v1.6.1] - 2026-07-24

### Fixed

- **output-sanitizer cleanup and fix** — Removed redundant branch logic in `sanitizeOutput` to simplify the code.
- Added `output-sanitizer.test.ts` unit test coverage.

### Changed

- All package versions aligned to v1.6.1.

## [v1.6.0] - 2026-07-24

### Added

- **Catgirl frosted-glass UI** — The extension popup and Builder UI now fully use frosted-glass visuals with soft catgirl theme tones.
- **Brand rename** — Project visual identity updated throughout.
- **Page recording shortcuts** — `Ctrl+Shift+1/2/3` start/pause/stop recording respectively.
- **Bundled shared runtime** — native-server postinstall installs the bundled shared runtime automatically, reducing manual build steps.
- **New page recorder architecture** — Added `page-recorder.ts`, `page-picker.ts`, and `tabs.test.ts`.

### Changed

- **Startup script streamlining** — `start-server.bat` / `start-server-npm.bat` reduced from 4 steps to 3, removing the separate shared build step.
- **Error log system rework** — Error logs moved from inline display to a modal dialog for better readability; added a network capture URL safety check.
- **Builder/Popup UI rework** — Heavily rewrote `App.vue` to improve the workflow editor UI.
- **Navigation resilience** — Clearer error fallback when page navigation fails.
- **Dependency upgrade** — pnpm upgraded from 11.15.1 to 11.17.0.

### Fixed

- **Native Messaging registration resilience** — Clear guidance when `EPERM` is detected, suggesting closing Chrome and retrying.

- All package versions aligned to v1.6.0.

## [v1.5.3] - 2026-07-21

### Fixed

- **Reliable scroll container detection**: `chrome_scroll` and `chrome_get_scroll_state` share the same real-container resolution, fixing virtual lists reporting success without actually moving.

### Added

- The `anchorSelector` parameter pins auto-detection to a content anchor in nested or virtual lists.
- Scroll results now include the target container and actual movement receipt.
- All release package versions aligned to v1.5.3.

## [v1.5.2] - 2026-07-21

### Added

- **Operation intent display**: Show the current step's `intent` in the browser status overlay so users can clearly understand each step while the AI runs.
  - 🏷️ Optional `intent` field added to all tool inputs
  - 🖥️ Status overlay (`chrome_operation_status`) shows an "Intent: xxx" line
  - 🔄 Long intent text truncated to 160 characters

### Changed

- **Type safety**: Model selection API migrated from `string` to the `ModelPreset` enum, eliminating runtime type risk.
- **Preview metadata structure**: Reworked preview metadata parsing in `AgentSessionListItem` and hardened the `WebEditorApply` type.
- All package versions aligned to v1.5.2.

## [v1.5.1] - 2026-07-19

### Added

- **Element code generation popup**: After marking an element, a popup shows the locator code instead of exporting a JSON file.
  - 🪟 Inline code popup UI with one-click copy to clipboard
  - 🌐 Supports JavaScript (querySelector / XPath) and Python (Selenium By) code formats
  - 📋 Clipboard API with fallback compatibility to work in all environments
  - ⌨️ Escape key closes the popup
  - 📑 Code tab switching (JS / Python) updates the copy button title to match the language

### Changed

- All package versions aligned to v1.5.1.

## [v1.5.0] - 2026-07-19

### Breaking

- **Workflow engine v3 architecture unification**: The legacy record-replay v2 code is fully migrated to the v3 unified architecture.
  - 🧹 Removed the v2 engine, recording modules, and node system (50+ files)
  - 🏗️ Action handlers unified into the `record-replay-v3/actions` module
  - 🔌 Plugin system reworked into `action-node-adapter` + `register-action-nodes`
  - 📦 Added `public-api` / `builder-types` / `utils` shared modules
  - 📉 Net reduction of ~12,300 lines of legacy code
  - 📦 Pre-v1.5.0 sources archived to the `V2toV3` branch

### Changed

- All package versions aligned to v1.5.0.

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
