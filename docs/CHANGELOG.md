# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v2.0.1] - 2026-08-13

### Changed

- **受限页面注入保护** — `BaseBrowserToolExecutor.injectFiles` 注入前检查标签页 URL 协议，对 `chrome:` / `edge:` / `devtools:` / `view-source:` 等受限页面主动抛出清晰错误，替代 Chrome 底层的晦涩拒绝。
- **键盘参数强校验** — `chrome_keyboard` 的 `keys` 参数在运行时校验必须为非空字符串，拒绝数组/对象等 MCP 传入的非法类型。
- **点击助手增强** — `click-helper` 等待目标元素可见后再触发点击；对不可见元素自动向上提升到可点击祖先（`button` / `[role="button"]` / `a` / `[data-testid]`）。
- **填充助手增强** — `fill-helper` 命中测试前先处理屏幕外可渲染候选元素，避免命中错误元素。
- 版本统一为 v2.0.1。

## [v2.0.0] - 2026-08-12

### Changed

- **CDP 会话管理重构** — 为每个 tab 的 `attach` / `detach` / `sendCommand` 增加 per-tab 串行锁，杜绝两个工具调用在 `getTargets()` 与 `debugger.attach()` 之间竞态导致的并发会话冲突；owner 从 `Set` 改为引用计数 `Map`，修复同一 owner 多次引用导致 detach 提前释放的会话泄漏。
- **`chrome_javascript` 取消支持** — 工具执行接入 `AbortSignal`：调用方取消或超时后通过新增的 `cdpSessionManager.abortOwner()` 主动 `debugger.detach()` 释放残留会话（1s 超时兜底），防止挂起的 `Runtime.evaluate` 长期占用 tab 的 debugger 导致后续工具连锁卡住；错误契约新增 `cancelled` 种类。
- **回归测试** — 新增 `cdp-session-manager.test.ts`（并发 attach 串行化、超时强制释放、owner 重复引用平衡）与 `chrome_javascript` 取消契约测试。
- 版本统一为 v2.0.0。

## [v1.9.2] - 2026-08-10

### Added

- **`chrome_paste_text` 工具** — 向富文本编辑器合成粘贴多段文本，专治 Draft.js 系编辑器（知乎、Medium 等）：给编辑器元素派发带 `DataTransfer` 的合成 `ClipboardEvent('paste')`，走原生 paste 路径完整接收全部段落，不依赖页面焦点、不读系统剪贴板；替代 `chrome_computer` type（带换行会错乱）、`execCommand('insertText')`（多段只留最后一段）与剪贴板 API（无焦点被拒）。建议粘贴后刷新页面验证草稿完整，再点击发布按钮。

### Changed

- 版本统一为 v1.9.2。

## [v1.9.1] - 2026-08-10

### Added

- **`chrome_post_to_x` 工具** — 在已登录的 X/Twitter 页面发布文本帖子：等待编辑框、填充并回读验证、等待发布按钮、点击一次、等待成功标记；明确返回 `published` / `failed` / `unknown`，未知时**不自动重试**避免重复发帖；支持自定义选择器兼容 X 页面变体。

### Changed

- **`chrome_handle_dialog` 增强** — 支持 `tabId` / `windowId` 指定目标标签页；覆盖 `beforeunload` 对话框处理。
- 交互工具（点击/填充助手、等待）细节增强。
- 版本统一为 v1.9.1。

## [v1.9.0] - 2026-08-10

### Added

- **`collect_virtual_lists` 工具** — 在多个标签页或窗口中**并发**采集动态/虚拟列表，按目标返回独立结果、状态、分批数据和失败原因；支持字段映射、去重、时长上限、分批返回与进度上报。

### Changed

- **`chrome_scroll` 真人滚动间隔不再随距离等比放大** — 修复 `intervalMs` 与 `steps` 同时按 amount 缩放导致总时长平方增长的问题；现在步数仍按 `600px = 15` 步为基准按距离等比计算，步间隔恒定（human / humanFast / humanSlow = 50 / 20 / 80ms），长距离真人滚动耗时与距离成线性关系；工具描述与文档同步更新。
- **MCP 实时进度链路** — 长耗时采集工具可通过 Native Messaging 的 `tool_progress` 消息逐步上报，并转换为标准 `notifications/progress`；最终结果协议保持兼容，取消和多窗口进度继续复用同一个请求上下文。
- 版本统一为 v1.9.0。

## [v1.8.4] - 2026-08-04

### Fixed

- **i18n 工具参数描述修复** — 为 26 个参数新增工具级描述覆盖，修复通用参数描述（`query` / `text` / `tabIds` / `tabId` / `url` / `action` 等）串扰到无关工具的问题（例如 `search_tabs_content.query` 误显示书签关键词）。
- **`chrome_scroll.mode` / `chrome_console.mode` 描述修正** — 通用 `mode` 条目原本是控制台专属语义，导致 `chrome_scroll.mode` 显示错误文本；现为两个工具分别补充工具级描述，并将通用条目改为中性文本。

### Changed

- 版本统一为 v1.8.4。

## [v1.8.9] - 2026-08-06

### Fixed

- **`chrome_scroll` 真人懒加载性能优化** — 每轮节奏内仅执行一次页面稳定等待（settle），不再每小步都等待，避免超出 MCP 请求预算；长距离真人滚动更稳定高效。

### Changed

- Popup 工具页面微调。
- 版本统一为 v1.8.9。

## [v1.8.8] - 2026-08-04

### Changed

- **`chrome_scroll` 真人滚动速度档位整体提速** — 三档基准间隔调整为 `human` 50ms / `humanFast` 20ms / `humanSlow` 80ms（原 100/50/150ms），滚动效率提升约一倍；工具描述与文档同步更新。
- **`package-extension.bat` 增强** — 自动检测 pnpm / corepack（无 pnpm 时回退 `corepack pnpm`）；shared 构建改用 `--filter` 方式。
- 版本统一为 v1.8.8。

## [v1.8.7] - 2026-08-04

### Added

- **`chrome_scroll` 真人滚动速度档位** — `human`、`humanFast`、`humanSlow` 三档分别使用 50ms、20ms、80ms 步间隔，配合 `humanLazyLoad` / `toBottom` 覆盖更多动态页面场景；工具描述与文档同步更新。

### Changed

- 版本统一为 v1.8.7。

## [v1.8.6] - 2026-08-04

### Added

- **MCP Server 版本动态化** — Stdio / HTTP 双通道的 server version 从硬编码 `1.0.0` 改为读取 `package.json`，客户端可准确感知插件版本。

### Fixed

- **i18n 修复** — 修正 `chrome_scroll` 的 `mode` 参数描述；新增工具级参数描述，避免通用文案误配；Popup MCP 工具目录中文翻译与 README_zh 对齐。

### Changed

- 工具超时逻辑简化：非长耗时工具统一 60s 上限（移除 navigate/download/upload 独立分类）。
- 版本统一为 v1.8.6。

## [v1.8.1] - 2026-08-04

### Added

- **`chrome_scroll` 真人滚动模式（`mode: 'human'`）** — 全新的人类行为模拟滚动：
  - 使用**原生 wheel 输入**逐像素滚动，而非直接设置 scrollTop，可触发页面真实滚动监听器
  - 分步推进（每步 600px、150ms 间隔），配合**加减速曲线**（ease-out）模拟真人滚轮节奏
  - `humanLazyLoad: true`：每小步后检测 DOM、布局和网络资源变化，等待页面稳定后再继续（800ms 超时），`toBottom` 配合可持续加载无限列表（最多 50 轮 / 9 秒上限）
- Scroll 工具描述与参数同步完善，新增对应测试。

### Changed

- 版本统一为 v1.8.1。

## [v1.8.0] - 2026-07-31

### Added

- **`chrome_proxy_rotate` 工具** — 调用方确认当前标签页异常时，轮换代理会话并重新加载页面（需已启用代理，不返回用户名或密码）。
- **英文工具描述** — 新增 `tools-en.ts` 全量英文工具描述，中英双语元数据完整覆盖。
- **Scroll 工具增强** — 滚动工具能力扩展（元素滚动、方向控制、超时处理等）。
- **Web Editor 性能监控更新** — `perf-monitor` 与消息监听增强，新增对应测试。

### Changed

- 版本统一为 v1.8.0。

## [v1.7.16] - 2026-07-31

### Added

- **代理（Proxy）支持** — 新增代理设置/管理能力：Options 与 Popup 页面新增代理配置 UI，支持代理接管状态控制。
- **`chrome_proxy_diagnostics` 工具** — 读取代理配置及 Chrome 接管状态；`action=test` 时验证代理出口 IP（不会返回用户名或密码）。
- **网络请求代理支持** — `network-request` 工具适配代理环境，新增对应测试。

### Changed

- 版本统一为 v1.7.16。

## [v1.7.5] - 2026-07-31

### Fixed

- **Cookie 工具修复** — 过滤工具元数据（`intent`/`background`）后再调用 `chrome.cookies` API，避免参数污染导致操作失败。
- **Popup App 修复** — 错误提示与弹窗界面调整。
- **错误日志修复** — `error-log.ts` 输出优化。

### Changed

- 版本统一为 v1.7.5。

## [v1.7.0] - 2026-07-31

### Added

- **`collect_virtual_list`** — 从动态/虚拟列表中稳定抽取去重记录，支持小步滚动、停滞判断和向上回扫。
- **`wait_extract_response`** — 导航或点击后等待指定 JSON 响应，并按 JSONPath 抽取记录。
- **`capture_debug_bundle`** — 将失败现场保存到下载目录：截图、DOM、控制台、脱敏网络摘要和元数据。
- **`resume_tab_task`** — 保存、读取或清除正常标签页的调用方状态（不创建无痕窗口，不读取 Cookie）。

### Changed

- Native Host：MCP SDK 升级至 `^1.30.0`，`drizzle-orm` 升级至 `^0.45.2`；`native-messaging-host` 请求 ID 生成、`file-handler` 与 `doctor` 脚本修复优化。
- Popup 工具页面与 DeepSeek 设置面板微调。
- 所有项目包版本统一为 v1.7.0。

## [v1.6.26] - 2026-07-31

### Added

- **新增 12+ 个工具** — `chrome_block_resources`（阻止资源加载）、`chrome_task_context`（任务上下文）、`chrome_scoped_action`（限定作用域操作）、`chrome_diagnostic_snapshot`（诊断快照）、`chrome_list_frames`（列出框架）、`chrome_find_and_click`（查找并点击）、`chrome_expand_section`（展开折叠区域）、`chrome_scan_for_section`（滚动查找区域）、`chrome_paginate_extract`（分页提取）、`chrome_extract_records`（提取记录）、`detect_empty_state`（检测空状态）、`merge_records`（合并记录）。
- **网络抓包重构** — webRequest / CDP 双通道统一，新增 `chrome_block_images` 升级版资源控制。
- **Popup 工具页面更新** — MCP 工具列表交互与展示优化。

### Changed

- Agent Chat 组件修复与优化。
- README 新增智能助手 UI 截图。
- 版本统一为 v1.6.26。

## [v1.6.19] - 2026-07-30

### Added

- **侧边栏聊天界面全面翻新** — 猫娘聊天背景、i18n 国际化支持、主题切换、设置面板重构。
- **选择器引擎大重构** — 新增 page handler，`element-marker.js` 注入脚本大幅优化，Builder/Sidepanel 多处体验改进。
- **Popup 页面调整** — 工具列表交互优化。
- 新增 `package-extension.bat` 打包脚本。

### Changed

- 语义相似度引擎改为静态导入 PREDEFINED_MODELS；wxt 配置禁用 modulePreload。
- DeepSeek 引擎更新并补充测试。
- 版本统一为 v1.6.19。

## [v1.6.4] - 2026-07-30

### Added

- **Cookie 管理三件套** — 新增 `chrome_cookie_get` / `chrome_cookie_set` / `chrome_cookie_delete` 三个工具，支持按 URL、域名、名称筛选查询、设置和删除 Cookie。
- **`chrome_get_interactive_elements`** — 恢复该工具（之前被遗漏）。
- 删除 `start-server-npm.bat`（与 `start-server.bat` 功能重复）。
- README 路线图更新：移除「工具级 ACL」，新增「待开发工具」计划表。

### Changed

- 版本统一为 v1.6.4。

## [v1.6.2] - 2026-07-30

### Added

- pnpm 版本升级至 11.18.0。

## [v1.6.1] - 2026-07-24

### Fixed

- **output-sanitizer 精简与修复** — 移除 `sanitizeOutput` 中的冗余分支逻辑，简化代码结构。
- 新增 `output-sanitizer.test.ts` 单元测试覆盖。

### Changed

- 所有包版本统一为 v1.6.1。

## [v1.6.0] - 2026-07-24

### Added

- **猫娘毛玻璃 UI** — 扩展弹窗和 Builder 界面全面采用毛玻璃视觉效果，配合柔和猫娘主题色调。
- **品牌更名** — 项目视觉标识统一更新。
- **页面录制快捷键** — `Ctrl+Shift+1/2/3` 分别控制开始/暂停/停止录制。
- **内嵌 Shared Runtime** — native-server postinstall 自动安装 bundled shared runtime，减少手动构建步骤。
- **页面录制器新架构** — 新增 `page-recorder.ts`、`page-picker.ts`、`tabs.test.ts`。

### Changed

- **启动脚本优化** — `start-server.bat` / `start-server-npm.bat` 从 4 步精简为 3 步，移除独立 shared build 步骤。
- **错误日志系统重构** — 错误日志从行内展示改为弹窗 Modal，提升查看体验；新增网络捕获 URL 安全检查。
- **Builder/Popup UI 重构** — 大幅重写 `App.vue`，优化工作流编辑器界面。
- **导航容错增强** — 页面导航失败时提供更清晰的错误回退。
- **依赖升级** — pnpm 从 11.15.1 升级至 11.17.0。

### Fixed

- **Native Messaging 注册容错** — 检测到 `EPERM` 时给出明确提示，建议关闭 Chrome 后重试。

- 所有包版本统一为 v1.6.0。

## [v1.5.3] - 2026-07-21

### Fixed

- **可靠滚动容器识别**: `chrome_scroll` 和 `chrome_get_scroll_state` 使用同一真实容器解析，修复虚拟列表上回执成功但未移动的问题。

### Added

- `anchorSelector` 参数可将自动识别锁定到嵌套或虚拟列表中的内容锚点。
- 滚动结果新增目标容器和实际位移回执。
- 所有发布包版本统一为 v1.5.3。

## [v1.5.2] - 2026-07-21

### Added

- **操作意图显示**: 在浏览器状态叠加层显示当前步骤的 `intent` 信息，AI 执行时用户可清晰了解每一步的意图。
  - 🏷️ 所有工具输入新增可选 `intent` 字段
  - 🖥️ 状态叠加层 (`chrome_operation_status`) 显示"意图：xxx"行
  - 🔄 自动截断长意图文本至 160 字符

### Changed

- **类型安全增强**: 模型选择接口从 `string` 迁移至 `ModelPreset` 枚举，消除运行时类型风险。
- **预览元数据结构优化**: `AgentSessionListItem` 中预览元数据解析逻辑重构，增强 `WebEditorApply` 类型的健壮性。
- 所有包版本统一为 v1.5.2

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
