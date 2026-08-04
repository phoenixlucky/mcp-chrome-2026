<template>
  <div class="mcp-tools-page">
    <div class="page-header">
      <button class="back-button" @click="$emit('back')" :title="copy.backTitle">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span>{{ copy.back }}</span>
      </button>
      <h2 class="page-title">{{ copy.title }}</h2>
      <button
        class="language-toggle"
        type="button"
        :aria-label="copy.languageTitle"
        :title="copy.languageTitle"
        @click="toggleLocale"
      >
        {{ locale === 'zh' ? 'EN' : '中文' }}
      </button>
    </div>

    <div class="page-content">
      <input
        v-model="query"
        class="tool-search"
        type="search"
        :placeholder="copy.searchPlaceholder"
        autofocus
      />
      <p class="tool-count"
        >{{ filteredTools.length }} / {{ toolSchemas.length }} {{ copy.tools }}</p
      >

      <div class="tool-list">
        <section v-for="group in toolGroups" :key="group.category" class="tool-group">
          <h3
            >{{ categoryLabel(group.category) }} <small>({{ group.tools.length }})</small></h3
          >
          <details v-for="tool in group.tools" :key="tool.name" class="tool-card">
            <summary>
              <code>{{ tool.name }}</code>
              <span>{{ descriptionFor(tool) }}</span>
              <small class="tool-launch-date">{{ copy.launchDate }}{{ launchDateFor(tool) }}</small>
              <span class="tool-badges">
                <small
                  v-for="badge in toolBadges(tool.name)"
                  :key="badge.kind"
                  class="tool-badge"
                  :class="badge.kind"
                  >{{ badge.icon }} {{ badge.label }}</small
                >
              </span>
            </summary>
            <div v-if="getProperties(tool).length" class="tool-params">
              <div v-for="[name, schema] in getProperties(tool)" :key="name" class="tool-param">
                <code>{{ name }}</code>
                <span
                  >{{ schema.type || 'any'
                  }}{{ isRequired(tool, name) ? ` · ${copy.required}` : '' }}</span
                >
                <small v-if="parameterDescriptionFor(tool, name, schema)">
                  {{ parameterDescriptionFor(tool, name, schema) }}
                </small>
              </div>
            </div>
            <p v-else class="no-params">{{ copy.noParameters }}</p>
          </details>
        </section>
        <p v-if="!filteredTools.length" class="empty-state">{{ copy.empty }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS, TOOL_SCHEMAS_EN } from '@ethanwilkins/chrome-mcp-shared-2026';

defineEmits<{ (e: 'back'): void }>();

const query = ref('');
type Locale = 'zh' | 'en';

const locale = ref<Locale>(localStorage.getItem('mcp-tools-locale') === 'en' ? 'en' : 'zh');
// Keep the page's shape and fallback text on the complete English catalog.
const toolSchemas = TOOL_SCHEMAS_EN;
const zhToolSchemas = new Map(TOOL_SCHEMAS.map((tool) => [tool.name, tool]));
const zhToolDescriptions = new Map(TOOL_SCHEMAS.map((tool) => [tool.name, tool.description]));
const messages = {
  zh: {
    back: '返回',
    backTitle: '返回首页',
    title: 'MCP 工具一览',
    languageTitle: '切换为 English',
    searchPlaceholder: '搜索工具名称或说明',
    tools: '个工具',
    required: '必填',
    noParameters: '无参数',
    empty: '没有匹配的工具',
    launchDate: '上线时间：',
  },
  en: {
    back: 'Back',
    backTitle: 'Back to home',
    title: 'MCP Tools',
    languageTitle: '切换为中文',
    searchPlaceholder: 'Search tool names or descriptions',
    tools: 'tools',
    required: 'required',
    noParameters: 'No parameters',
    empty: 'No matching tools',
    launchDate: 'Launched: ',
  },
} as const;

const copy = computed(() => messages[locale.value]);

// MCP catalog launch dates, based on the first release that exposed each tool.
const launchDates: Record<string, string> = {
  search_tabs_content: '2025-06-09',
  get_windows_and_tabs: '2025-06-09',
  chrome_cookie_get: '2026-07-30',
  chrome_cookie_set: '2026-07-30',
  chrome_cookie_delete: '2026-07-30',
  performance_start_trace: '2025-10-10',
  performance_stop_trace: '2025-10-10',
  performance_analyze_insight: '2025-10-10',
  chrome_read_page: '2025-10-09',
  chrome_computer: '2025-10-09',
  chrome_navigate: '2025-06-09',
  chrome_screenshot: '2025-06-09',
  chrome_close_tabs: '2025-06-09',
  chrome_switch_tab: '2025-07-24',
  chrome_get_web_content: '2025-06-09',
  chrome_network_request: '2025-06-09',
  chrome_network_capture: '2025-12-25',
  chrome_block_images: '2026-07-17',
  chrome_block_resources: '2026-07-31',
  chrome_handle_download: '2025-10-13',
  chrome_history: '2025-06-09',
  chrome_bookmark_search: '2025-06-09',
  chrome_bookmark_add: '2025-06-09',
  chrome_bookmark_delete: '2025-06-09',
  chrome_javascript: '2025-12-24',
  chrome_click_element: '2025-06-09',
  chrome_fill_or_select: '2025-06-09',
  chrome_request_element_selection: '2025-12-29',
  chrome_get_interactive_elements: '2025-06-09',
  chrome_keyboard: '2025-06-09',
  chrome_console: '2025-06-22',
  chrome_upload_file: '2025-08-08',
  chrome_handle_dialog: '2025-10-09',
  chrome_gif_recorder: '2025-12-24',
  chrome_get_page_text: '2026-07-15',
  chrome_spa_fetch: '2026-07-29',
  chrome_get_tab_url: '2026-07-15',
  chrome_get_scroll_state: '2026-07-17',
  chrome_scroll: '2026-07-15',
  chrome_wait: '2026-07-15',
  chrome_extract: '2026-07-15',
  chrome_click_and_wait: '2026-07-15',
  chrome_task_context: '2026-07-31',
  chrome_scoped_action: '2026-07-31',
  chrome_diagnostic_snapshot: '2026-07-31',
  chrome_list_frames: '2026-07-31',
  chrome_find_and_click: '2026-07-31',
  chrome_expand_section: '2026-07-31',
  chrome_scan_for_section: '2026-07-31',
  chrome_paginate_extract: '2026-07-31',
  chrome_extract_records: '2026-07-31',
  detect_empty_state: '2026-07-31',
  merge_records: '2026-07-31',
  collect_virtual_list: '2026-07-31',
  wait_extract_response: '2026-07-31',
  capture_debug_bundle: '2026-07-31',
  resume_tab_task: '2026-07-31',
};

const zhDescriptions: Record<string, string> = {
  search_tabs_content: '使用语义相似度搜索用户明确选定标签页中的可读内容；标签页会按需建立索引。',
  collect_virtual_list: '从动态或虚拟列表中稳定抽取去重记录，支持小步滚动、停滞判断和向上回扫。',
  wait_extract_response: '执行导航或点击后等待指定 JSON 响应，并按调用方提供的 JSONPath 抽取记录。',
  capture_debug_bundle: '将失败现场保存到下载目录：截图、DOM、控制台、脱敏网络摘要和元数据。',
  resume_tab_task:
    '保存、读取或清除正常浏览器标签页的调用方状态；不会创建无痕窗口，也不会读取 Cookie。',
  get_windows_and_tabs: '列出当前打开的所有浏览器窗口和标签页。',
  chrome_cookie_get: '获取浏览器 Cookie；可按 URL、域名、名称或浏览器存储分区筛选。',
  chrome_cookie_set: '设置浏览器 Cookie，支持 HttpOnly、Secure、SameSite、路径和过期时间。',
  chrome_cookie_delete: '按 URL 和名称删除 Cookie。',
  performance_start_trace: '开始记录所选页面的性能追踪；可选自动刷新和自动停止。',
  performance_stop_trace: '停止所选页面正在进行的性能追踪。',
  performance_analyze_insight: '汇总最近一次性能追踪；可用于后续深入分析。',
  chrome_read_page: '读取页面中可见元素的无障碍树，可按交互元素筛选。',
  chrome_computer: '通过鼠标、键盘和截图与浏览器交互。',
  chrome_navigate: '打开 URL、刷新当前标签页，或在浏览历史中前进和后退。',
  chrome_screenshot: '截取当前页面或指定元素的截图；复杂场景优先使用 chrome_computer。',
  chrome_close_tabs: '关闭一个或多个浏览器标签页。',
  chrome_switch_tab: '切换到指定浏览器标签页。',
  chrome_get_web_content: '从网页提取 HTML 或文本内容。',
  chrome_network_request: '在浏览器上下文中发送网络请求，携带 Cookie 等会话信息。',
  chrome_network_capture: '统一采集网络请求；可按需采集响应体。',
  chrome_block_images: '使用 Chrome DevTools Protocol 阻止标签页加载图片。',
  chrome_handle_download: '等待浏览器下载并返回下载详情。',
  chrome_history: '读取并搜索 Chrome 浏览历史。',
  chrome_bookmark_search: '按标题和 URL 搜索 Chrome 书签。',
  chrome_bookmark_add: '向 Chrome 添加书签，支持指定文件夹。',
  chrome_bookmark_delete: '按 ID 或 URL 从 Chrome 删除书签。',
  chrome_javascript: '在浏览器标签页中执行 JavaScript 并返回结果。',
  chrome_click_element: '点击网页元素，支持 CSS、XPath、元素引用和坐标定位。',
  chrome_fill_or_select: '填写输入框或选择表单控件的值。',
  chrome_request_element_selection: '请求用户手动选择当前页面上的一个或多个元素。',
  chrome_keyboard: '向页面或指定元素发送键盘输入。',
  chrome_console: '读取、清空或订阅页面控制台日志。',
  chrome_upload_file: '向网页表单中的文件输入控件上传文件。',
  chrome_handle_dialog: '处理浏览器对话框，例如 alert、confirm 和 prompt。',
  chrome_gif_recorder: '录制页面操作或定时截图，并导出 GIF。',
  chrome_get_page_text: '使用 Readability 提取页面可读的正文，并返回 HTML 与文章元数据。',
  chrome_spa_fetch:
    '专为 SPA（单页应用）设计：自动导航、等待 JS 渲染、滚动触发懒加载后提取完整文本。',
  chrome_get_tab_url: '获取指定标签页的当前 URL、标题和图标。',
  chrome_get_scroll_state: '获取页面或可滚动容器的原生滚动状态，用于判断是否到达底部或顶部。',
  chrome_scroll: '滚动页面或指定滚动容器，支持像素、边界和元素定位。',
  chrome_wait: '等待 DOM 元素或 JavaScript 条件满足。',
  chrome_extract: '使用 CSS 选择器从网页提取结构化数据，支持嵌套字段、同源 iframe 和表格提取。',
  chrome_click_and_wait: '点击 CSS 选择的元素后，等待另一元素达到指定状态。',
};

const zhToolParameterDescriptions: Record<string, string> = {
  'chrome_cookie_get.url': '仅返回适用于此 URL 的 Cookie。',
  'chrome_cookie_get.domain': '仅返回此域名下的 Cookie。',
  'chrome_cookie_get.name': '仅返回此名称的 Cookie。',
  'chrome_cookie_get.storeId': '仅返回此浏览器配置存储分区中的 Cookie。',
  'chrome_cookie_set.url': 'Cookie 所属域名下的 URL；Chrome 设置 Cookie 时必填。',
  'chrome_cookie_set.name': 'Cookie 名称。',
  'chrome_cookie_set.domain': 'Cookie 所属域名，必须与 URL 主机匹配。',
  'chrome_cookie_set.path': 'Cookie 生效路径，默认 /。',
  'chrome_cookie_set.secure': '是否仅通过 HTTPS 发送。',
  'chrome_cookie_set.httpOnly': '是否禁止页面 JavaScript 访问。',
  'chrome_cookie_set.sameSite': '跨站请求的 SameSite 策略。',
  'chrome_cookie_set.expirationDate': '过期时间，Unix 时间戳（秒）；省略则为会话 Cookie。',
  'chrome_cookie_set.storeId': '浏览器配置存储分区 ID。',
  'chrome_cookie_delete.url': '用于定位要删除 Cookie 的 URL。',
  'chrome_cookie_delete.name': 'Cookie 名称。',
  'chrome_cookie_delete.storeId': '浏览器配置存储分区 ID。',
};

const zhParameterDescriptions: Record<string, string> = {
  intent: '可选的当前操作意图，会显示在浏览器状态浮层中。',
  reload: '开始追踪后是否自动刷新页面（忽略缓存）。',
  autoStop: '是否自动停止追踪。',
  durationMs: '持续时间，单位为毫秒。',
  saveToDownloads: '是否将结果保存到下载目录。',
  filenamePrefix: '下载文件名的可选前缀。',
  insightName: '用于后续深入分析的可选洞察名称。',
  timeoutMs: '超时时间，单位为毫秒。',
  filter: '元素筛选方式，例如仅返回可交互元素。',
  depth: '遍历的最大 DOM 深度。',
  refId: '来自 chrome_read_page 的元素引用 ID。',
  tabId: '目标标签页 ID；默认当前激活标签页。',
  windowId: '目标窗口 ID；未指定标签页时用来选择激活标签页。',
  background: '尽量不激活标签页或聚焦窗口。',
  action: '要执行的操作。',
  ref: '来自 chrome_read_page 的元素引用。',
  coordinates: '操作使用的视口坐标。',
  startCoordinates: '拖拽起点坐标。',
  startRef: '拖拽起点的元素引用。',
  scrollDirection: '滚动方向。',
  scrollAmount: '滚动步数或距离。',
  text: '要输入的文本，或要发送的按键组合。',
  repeat: '按键序列的重复次数。',
  modifiers: '点击时按住的修饰键。',
  region: '截图或缩放操作的矩形区域。',
  selector: '目标元素的 CSS 选择器。',
  value: '要填写或设置的值。',
  elements: '批量填写的元素和对应值。',
  width: '宽度，单位为像素。',
  height: '高度，单位为像素。',
  appear: '等待文本出现或消失。',
  timeout: '超时时间，单位为毫秒。',
  duration: '等待时长，单位为秒。',
  url: '目标页面或请求的 URL。',
  newWindow: '是否在新窗口中打开目标 URL。',
  activateTab: '在后台模式下是否保持目标标签页激活。',
  refresh: '是否刷新当前标签页而非打开 URL。',
  expectedUrl: '仅当目标标签页 URL 以该值开头时才执行，否则拒绝调用。',
  name: '截图名称。',
  storeBase64: '是否以 Base64 格式返回截图。',
  fullPage: '是否截取整个页面。',
  savePng: '是否将截图保存为 PNG 文件。',
  tabIds: '要关闭的标签页 ID 列表。',
  htmlContent: '是否返回页面可见 HTML。',
  textContent: '是否返回页面可见文本和元数据。',
  method: 'HTTP 请求方法。',
  headers: '请求中包含的 HTTP 标头。',
  body: '请求正文，适用于 POST、PUT 等方法。',
  formData: 'multipart/form-data 表单数据及可选文件附件。',
  needResponseBody: '是否采集网络响应正文；会使用调试器 API。',
  maxCaptureTime: '网络采集的最长持续时间，单位为毫秒。',
  inactivityTimeout: '无网络活动后自动停止的等待时间，单位为毫秒。',
  includeStatic: '是否包含图片、脚本和样式等静态资源。',
  filenameContains: '按文件名或 URL 中的文本筛选下载项。',
  waitForComplete: '是否等待下载完成。',
  startTime: '浏览历史查询的起始时间。',
  endTime: '浏览历史查询的结束时间。',
  maxResults: '最多返回的结果数量。',
  excludeCurrentTabs: '是否排除当前已打开的标签页。',
  query: '书签搜索关键词。',
  folderPath: '用于限定书签搜索范围的文件夹路径或 ID。',
  title: '书签标题；未提供时使用页面标题。',
  parentId: '新增书签所在的父文件夹路径或 ID。',
  createFolder: '父文件夹不存在时是否自动创建。',
  bookmarkId: '要删除的书签 ID。',
  code: '在页面上下文中执行的 JavaScript 代码。',
  maxOutputBytes: '清理敏感信息后允许返回的最大输出字节数。',
  requireResult: '是否要求脚本必须返回一个值。',
  selectorType: '选择器类型，例如 CSS 或 XPath。',
  double: '是否执行双击。',
  button: '要使用的鼠标按键。',
  waitForNavigation: '点击后是否等待页面导航完成。',
  frameId: '目标框架 ID。',
  requests: '元素选择请求列表。',
  keys: '要发送的键或键盘组合。',
  delay: '连续按键之间的延迟时间。',
  includeExceptions: '是否包含未捕获异常。',
  maxMessages: '最多返回的控制台消息数量。',
  mode: '控制台日志的读取或订阅模式。',
  buffer: '是否使用缓冲区模式。',
  clear: '是否在读取前清空日志。',
  clearAfterRead: '是否在读取后清空日志。',
  pattern: '用于筛选日志的匹配模式。',
  onlyErrors: '是否只返回错误日志。',
  limit: '最多返回或提取的项目数量。',
  filePath: '要上传文件的本地路径。',
  fileUrl: '要上传文件的 URL。',
  base64Data: '以 Base64 编码提供的文件内容。',
  fileName: '上传时使用的文件名。',
  multiple: '是否允许上传多个文件。',
  promptText: '对 prompt 对话框输入的文本。',
  fps: '固定帧率录制时每秒采集的帧数。',
  maxFrames: '最多采集的帧数。',
  maxColors: 'GIF 调色板允许的最大颜色数。',
  filename: '输出文件名。',
  captureDelayMs: '操作后延迟多久再采集画面，单位为毫秒。',
  frameDelayCs: '自动采集模式下每帧的显示时间，单位为百分之一秒。',
  annotation: '自动采集画面上显示的可选文字标签。',
  download: '导出 GIF 时是否下载文件。',
  enhancedRendering: '是否为录制的操作添加点击、拖拽和标签等视觉效果。',
  maxScrolls: '最多向页面底部滚动的次数。',
  scrollDelay: '每次滚动后等待内容加载的时间，单位为毫秒。',
  waitForSelector: '提取前要等待出现的 CSS 选择器。',
  waitTimeout: '等待元素出现的最长时间，单位为毫秒。',
  extractHtml: '是否同时返回渲染后的 HTML。',
  containerSelector: '滚动容器的 CSS 选择器。',
  anchorSelector: '滚动容器内内容锚点的 CSS 选择器。',
  frameSelector: '同源 iframe 的 CSS 选择器。',
  amount: '滚动像素数；正值向下或向右。',
  direction: '滚动方向。',
  toBottom: '是否滚动到容器底部。',
  lazyLoad: '是否以分步滚动方式触发懒加载内容。',
  lazyLoadStep: '每次懒加载滚动的像素数。',
  lazyLoadWaitMs: '每次懒加载滚动后的等待时间，单位为毫秒。',
  lazyLoadMaxSteps: '单次请求中允许的最大懒加载滚动步数。',
  toTop: '是否滚动到容器顶部。',
  scrollIntoView: '指定元素时是否调用 scrollIntoView。',
  block: '元素滚入视图时的垂直对齐方式。',
  behavior: '滚动行为，例如即时或平滑滚动。',
  jsCondition: '在页面中求值、并应返回布尔值的 JavaScript 条件。',
  pollInterval: '检查条件的轮询间隔，单位为毫秒。',
  stableForMs: '条件需连续成立的时间，单位为毫秒。',
  fields: '从每个匹配元素中提取的字段定义。',
  contextSelector: '缩小数据提取范围的父容器 CSS 选择器。',
  offset: '跳过前面的匹配元素数量。',
  waitSelector: '点击后需要等待的 CSS 选择器。',
  waitFor: '目标元素需要达到的状态。',
};

const enToolParameterDescriptions = new Map<string, string>();
for (const t of TOOL_SCHEMAS_EN) {
  const props = (t.inputSchema.properties || {}) as Record<string, PropertySchema>;
  for (const [name, schema] of Object.entries(props)) {
    if (schema.description)
      enToolParameterDescriptions.set(`${t.name}.${name}`, schema.description);
  }
}

const descriptionFor = (tool: Tool) =>
  locale.value === 'zh'
    ? (zhDescriptions[tool.name] ?? zhToolDescriptions.get(tool.name) ?? tool.description)
    : tool.description;
const launchDateFor = (tool: Tool) => launchDates[tool.name] ?? '—';
const zhParameterSchema = (tool: Tool, name: string) => {
  return (
    zhToolSchemas.get(tool.name)?.inputSchema.properties as
      Record<string, PropertySchema> | undefined
  )?.[name];
};
const parameterDescriptionFor = (tool: Tool, name: string, schema: PropertySchema) =>
  locale.value === 'zh'
    ? (zhToolParameterDescriptions[`${tool.name}.${name}`] ??
      zhParameterDescriptions[name] ??
      zhParameterSchema(tool, name)?.description ??
      schema.description)
    : (enToolParameterDescriptions.get(`${tool.name}.${name}`) ?? schema.description);

function toggleLocale() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem('mcp-tools-locale', locale.value);
}

const filteredTools = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return keyword
    ? toolSchemas.filter((tool) =>
        `${tool.name} ${tool.description} ${zhDescriptions[tool.name] ?? ''} ${zhToolDescriptions.get(tool.name) ?? ''}`
          .toLowerCase()
          .includes(keyword),
      )
    : toolSchemas;
});

const reviewTools = new Set([
  'chrome_find_and_click',
  'chrome_expand_section',
  'chrome_scan_for_section',
  'chrome_paginate_extract',
  'chrome_extract_records',
  'detect_empty_state',
  'merge_records',
]);
const scrapingTools = new Set([
  'chrome_get_tab_url',
  'chrome_get_scroll_state',
  'chrome_scroll',
  'chrome_wait',
  'chrome_extract',
  'chrome_get_page_text',
  'chrome_spa_fetch',
  'chrome_click_and_wait',
  'chrome_task_context',
  'chrome_scoped_action',
  'chrome_diagnostic_snapshot',
  'chrome_list_frames',
  'collect_virtual_list',
  'wait_extract_response',
  'resume_tab_task',
]);

const categoryFor = (name: string) => {
  if (reviewTools.has(name)) return 'reviews';
  if (scrapingTools.has(name)) return 'scraping';
  if (name.includes('network') || name.startsWith('chrome_block_')) return 'network';
  if (name.startsWith('chrome_cookie_')) return 'cookies';
  if (name.startsWith('performance_')) return 'performance';
  if (name.startsWith('chrome_bookmark_') || name === 'chrome_history') return 'data';
  if (
    name.includes('screenshot') ||
    name.includes('gif_recorder') ||
    name === 'capture_debug_bundle'
  )
    return 'capture';
  if (
    ['get_windows_and_tabs', 'chrome_navigate', 'chrome_close_tabs', 'chrome_switch_tab'].includes(
      name,
    )
  )
    return 'tabs';
  return 'interaction';
};
const categoryLabels = {
  zh: {
    reviews: '评价抓取',
    scraping: '采集提取',
    network: '网络监控',
    cookies: 'Cookie 管理',
    performance: '性能诊断',
    data: '历史与书签',
    capture: '截图与录制',
    tabs: '标签页管理',
    interaction: '交互操作',
  },
  en: {
    reviews: 'Review scraping',
    scraping: 'Page scraping',
    network: 'Network',
    cookies: 'Cookies',
    performance: 'Performance',
    data: 'History & bookmarks',
    capture: 'Capture',
    tabs: 'Tabs',
    interaction: 'Page interaction',
  },
} as const;
const categoryLabel = (category: keyof typeof categoryLabels.zh) =>
  categoryLabels[locale.value][category];
const toolGroups = computed(() => {
  const groups = new Map<keyof typeof categoryLabels.zh, Tool[]>();
  for (const tool of filteredTools.value) {
    const category = categoryFor(tool.name) as keyof typeof categoryLabels.zh;
    groups.set(category, [...(groups.get(category) || []), tool]);
  }
  return [...groups].map(([category, tools]) => ({ category, tools }));
});

const advancedTools = new Set([
  'chrome_javascript',
  'chrome_computer',
  'chrome_network_capture',
  'chrome_block_resources',
  'chrome_console',
  'chrome_task_context',
  'chrome_scoped_action',
  'chrome_diagnostic_snapshot',
  'chrome_list_frames',
  'wait_extract_response',
  'performance_start_trace',
  'performance_stop_trace',
  'performance_analyze_insight',
]);
const commonTools = new Set([
  'chrome_navigate',
  'chrome_screenshot',
  'chrome_click_element',
  'chrome_fill_or_select',
  'chrome_get_web_content',
  'chrome_get_page_text',
  'chrome_scroll',
  'chrome_wait',
  'chrome_extract',
  'chrome_find_and_click',
  'chrome_paginate_extract',
]);
const toolBadges = (name: string) => {
  const advanced = advancedTools.has(name);
  const common = commonTools.has(name);
  const zh = locale.value === 'zh';
  return [
    {
      kind: 'ease',
      icon: '⚡',
      label: `${zh ? '易用' : 'Ease'}：${advanced ? (zh ? '中' : 'Medium') : zh ? '高' : 'High'}`,
    },
    {
      kind: 'usage',
      icon: '★',
      label: `${zh ? '常用' : 'Use'}：${common ? (zh ? '高' : 'High') : advanced ? (zh ? '低' : 'Low') : zh ? '中' : 'Medium'}`,
    },
    {
      kind: advanced ? 'advanced' : 'recommended',
      icon: advanced ? '○' : '✓',
      label: advanced ? (zh ? '进阶' : 'Advanced') : zh ? '推荐' : 'Recommended',
    },
  ];
};

type PropertySchema = { type?: string; description?: string };
const getProperties = (tool: Tool) =>
  Object.entries((tool.inputSchema.properties || {}) as Record<string, PropertySchema>);
const isRequired = (tool: Tool, name: string) => (tool.inputSchema.required || []).includes(name);
</script>

<style scoped>
.mcp-tools-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ac-bg, #fafaf9);
}
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--ac-border, #e7e5e4);
  background: var(--ac-surface, #fff);
}
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ac-text-subtle, #78716c);
}
.page-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  color: var(--ac-text, #1c1917);
}
.language-toggle {
  padding: 4px 8px;
  border: 1px solid var(--ac-border, #e7e5e4);
  border-radius: 6px;
  color: var(--ac-text-subtle, #78716c);
  background: var(--ac-surface, #fff);
  font-size: 12px;
  cursor: pointer;
}
.language-toggle:hover {
  color: var(--ac-accent, #d97757);
  border-color: var(--ac-accent, #d97757);
}
.page-content {
  overflow-y: auto;
  padding: 16px;
}
.tool-search {
  width: 100%;
  padding: 9px 12px;
}
.tool-count {
  margin: 8px 0 12px;
  color: var(--ac-text-subtle, #78716c);
  font-size: 12px;
}
.tool-list {
  display: grid;
  gap: 8px;
}
.tool-group {
  display: grid;
  gap: 8px;
}
.tool-group h3 {
  margin: 8px 0 0;
  color: var(--ac-text, #1c1917);
  font-size: 13px;
}
.tool-group h3 small {
  color: var(--ac-text-subtle, #78716c);
  font-weight: 400;
}
.tool-card {
  border: 1px solid var(--ac-border, #e7e5e4);
  border-radius: 8px;
  background: var(--ac-surface, #fff);
}
.tool-card summary {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  cursor: pointer;
}
.tool-card summary span,
.tool-param small,
.tool-launch-date {
  color: var(--ac-text-subtle, #78716c);
  font-size: 12px;
}
.tool-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tool-card summary .tool-badge {
  border-radius: 999px;
  padding: 2px 6px;
  background: #f5f5f4;
  font-size: 11px;
}
.tool-card summary .tool-badge.recommended {
  color: #15803d;
  background: #f0fdf4;
}
.tool-card summary .tool-badge.advanced {
  color: #a16207;
  background: #fefce8;
}
.tool-card code,
.tool-param code {
  color: var(--ac-accent, #d97757);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.tool-params {
  border-top: 1px solid var(--ac-border, #e7e5e4);
  padding: 8px 12px;
}
.tool-param {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 8px;
  padding: 6px 0;
}
.tool-param small {
  grid-column: 1 / -1;
}
.tool-param span,
.no-params {
  color: var(--ac-text-subtle, #78716c);
  font-size: 11px;
}
.no-params,
.empty-state {
  margin: 0;
  padding: 10px 12px;
  color: var(--ac-text-subtle, #78716c);
  font-size: 12px;
}
</style>
