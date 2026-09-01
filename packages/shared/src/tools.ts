import { type Tool } from '@modelcontextprotocol/sdk/types.js';

export const TOOL_NAMES = {
  BROWSER: {
    GET_WINDOWS_AND_TABS: 'get_windows_and_tabs',
    CREATE_TAB: 'chrome_create_tab',
    NAVIGATE: 'chrome_navigate',
    SCREENSHOT: 'chrome_screenshot',
    CLOSE_TABS: 'chrome_close_tabs',
    SWITCH_TAB: 'chrome_switch_tab',
    WEB_FETCHER: 'chrome_get_web_content',
    CLICK: 'chrome_click_element',
    FILL: 'chrome_fill_or_select',
    LOCATE_ELEMENT: 'chrome_locate_element',
    SELECT_ALL_ITEMS: 'chrome_select_all_items',
    REQUEST_ELEMENT_SELECTION: 'chrome_request_element_selection',
    GET_INTERACTIVE_ELEMENTS: 'chrome_get_interactive_elements',
    NETWORK_CAPTURE: 'chrome_network_capture',
    BLOCK_IMAGES: 'chrome_block_images',
    BLOCK_RESOURCES: 'chrome_block_resources',
    // Legacy tool names (kept for internal use, not exposed in TOOL_SCHEMAS)
    NETWORK_CAPTURE_START: 'chrome_network_capture_start',
    NETWORK_CAPTURE_STOP: 'chrome_network_capture_stop',
    NETWORK_REQUEST: 'chrome_network_request',
    NETWORK_DEBUGGER_START: 'chrome_network_debugger_start',
    NETWORK_DEBUGGER_STOP: 'chrome_network_debugger_stop',
    KEYBOARD: 'chrome_keyboard',
    HISTORY: 'chrome_history',
    BOOKMARK_SEARCH: 'chrome_bookmark_search',
    BOOKMARK_ADD: 'chrome_bookmark_add',
    BOOKMARK_DELETE: 'chrome_bookmark_delete',
    JAVASCRIPT: 'chrome_javascript',
    PASTE_TEXT: 'chrome_paste_text',
    PASTE_IMAGE: 'chrome_paste_image',
    CONSOLE: 'chrome_console',
    FILE_UPLOAD: 'chrome_upload_file',
    GET_FORM_VALUE: 'chrome_get_form_value',
    READ_PAGE: 'chrome_read_page',
    COMPUTER: 'chrome_computer',
    POST_TO_X: 'chrome_post_to_x',
    HANDLE_DIALOG: 'chrome_handle_dialog',
    HANDLE_DOWNLOAD: 'chrome_handle_download',
    USERSCRIPT: 'chrome_userscript',
    COOKIE_GET: 'chrome_cookie_get',
    COOKIE_SET: 'chrome_cookie_set',
    COOKIE_DELETE: 'chrome_cookie_delete',
    HOVER: 'chrome_hover',
    PRINT_TO_PDF: 'chrome_print_to_pdf',
    GET_ELEMENT_INFO: 'chrome_get_element_info',
    STORAGE_GET: 'chrome_storage_get',
    STORAGE_SET: 'chrome_storage_set',
    STORAGE_DELETE: 'chrome_storage_delete',
    PERFORMANCE_START_TRACE: 'performance_start_trace',
    PERFORMANCE_STOP_TRACE: 'performance_stop_trace',
    PERFORMANCE_ANALYZE_INSIGHT: 'performance_analyze_insight',
    GIF_RECORDER: 'chrome_gif_recorder',
    // Scraping tools
    GET_TAB_URL: 'chrome_get_tab_url',
    GET_SCROLL_STATE: 'chrome_get_scroll_state',
    SCROLL: 'chrome_scroll',
    WAIT: 'chrome_wait',
    EXTRACT: 'chrome_extract',
    GET_PAGE_TEXT: 'chrome_get_page_text',
    SPA_FETCH: 'chrome_spa_fetch',
    CLICK_AND_WAIT: 'chrome_click_and_wait',
    TASK_CONTEXT: 'chrome_task_context',
    SCOPED_ACTION: 'chrome_scoped_action',
    DIAGNOSTIC_SNAPSHOT: 'chrome_diagnostic_snapshot',
    PROXY_DIAGNOSTICS: 'chrome_proxy_diagnostics',
    PROXY_ROTATE: 'chrome_proxy_rotate',
    LIST_FRAMES: 'chrome_list_frames',
    FIND_AND_CLICK: 'chrome_find_and_click',
    EXPAND_SECTION: 'chrome_expand_section',
    SCAN_FOR_SECTION: 'chrome_scan_for_section',
    PAGINATE_EXTRACT: 'chrome_paginate_extract',
    EXTRACT_RECORDS: 'chrome_extract_records',
    DETECT_EMPTY_STATE: 'detect_empty_state',
    MERGE_RECORDS: 'merge_records',
    COLLECT_VIRTUAL_LIST: 'collect_virtual_list',
    COLLECT_VIRTUAL_LISTS: 'collect_virtual_lists',
    WAIT_EXTRACT_RESPONSE: 'wait_extract_response',
    CAPTURE_DEBUG_BUNDLE: 'capture_debug_bundle',
    RESUME_TAB_TASK: 'resume_tab_task',
    PROFILE: 'chrome_profile',
    BATCH: 'chrome_batch',
  },
};

export const TOOL_SCHEMAS: Tool[] = [
  {
    name: TOOL_NAMES.BROWSER.PROFILE,
    description:
      '管理隔离浏览器 Profile。默认工具调用仍操作当前 Chrome；为普通浏览器工具传入 profileId 后，会在该 Profile 中执行。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create', 'launch', 'stop', 'delete', 'status', 'diagnostics'],
        },
        profileId: { type: 'string' },
        name: { type: 'string' },
        userDataDir: { type: 'string' },
        chromePath: { type: 'string' },
        extensionPath: { type: 'string' },
        launchArgs: { type: 'array', items: { type: 'string' } },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BATCH,
    description: '按顺序执行一组浏览器工具调用；可用 profileId 将整组任务固定到独立 Profile。',
    inputSchema: {
      type: 'object',
      properties: {
        calls: {
          type: 'array',
          maxItems: 50,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              arguments: { type: 'object' },
            },
            required: ['name'],
          },
        },
        stopOnError: { type: 'boolean', default: true },
      },
      required: ['calls'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COLLECT_VIRTUAL_LIST,
    description: '从动态或虚拟列表中稳定抽取去重记录，支持小步滚动、停滞判断和向上回扫。',
    inputSchema: {
      type: 'object',
      properties: {
        cardSelector: { type: 'string' },
        fields: { type: 'array', items: { type: 'object' } },
        identityFields: { type: 'array', items: { type: 'string' } },
        maxItems: { type: 'number' },
        maxDurationMs: { type: 'number' },
        returnBatches: { type: 'boolean' },
        batchSize: { type: 'number' },
        returnProgress: { type: 'boolean' },
        progressEverySteps: { type: 'number' },
        containerSelector: { type: 'string' },
        anchorSelector: { type: 'string' },
        scroll: { type: 'object' },
        state: { type: 'object' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['cardSelector', 'fields', 'identityFields'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COLLECT_VIRTUAL_LISTS,
    description:
      '在多个标签页或窗口中并发采集动态/虚拟列表，按目标返回独立结果、状态、分批数据和失败原因。',
    inputSchema: {
      type: 'object',
      properties: {
        targets: { type: 'array', items: { type: 'object' } },
        cardSelector: { type: 'string' },
        fields: { type: 'array', items: { type: 'object' } },
        identityFields: { type: 'array', items: { type: 'string' } },
        maxItems: { type: 'number' },
        maxDurationMs: { type: 'number' },
        returnBatches: { type: 'boolean' },
        batchSize: { type: 'number' },
        returnProgress: { type: 'boolean' },
        progressEverySteps: { type: 'number' },
        containerSelector: { type: 'string' },
        anchorSelector: { type: 'string' },
        scroll: { type: 'object' },
        maxConcurrency: { type: 'number' },
        failFast: { type: 'boolean' },
      },
      required: ['targets', 'cardSelector', 'fields', 'identityFields'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.WAIT_EXTRACT_RESPONSE,
    description:
      '执行导航或点击后等待指定网络响应。可选地点击确认按钮、返回 HTTP 状态、请求体和响应体，用于核验删除等异步操作是否真正成功；若要抽取 JSON 记录再提供 extract。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'object' },
        confirm: { type: 'object' },
        response: { type: 'object' },
        extract: { type: 'object' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['action', 'response'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CAPTURE_DEBUG_BUNDLE,
    description: '将失败现场保存到下载目录：截图、DOM、控制台、脱敏网络摘要和元数据。',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        domLimit: { type: 'number' },
        consoleLimit: { type: 'number' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
      },
      required: ['reason'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.RESUME_TAB_TASK,
    description:
      '保存、读取或清除正常浏览器标签页的调用方状态；不会创建无痕窗口，也不会读取 Cookie。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['save', 'get', 'clear'] },
        taskId: { type: 'string' },
        state: { type: 'object' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
      },
      required: ['action', 'taskId'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.FIND_AND_CLICK,
    description: '在可选作用域内依次尝试 CSS、XPath 或文本候选项，点击第一个可见且可用的匹配元素。',
    inputSchema: {
      type: 'object',
      properties: {
        candidates: { type: 'array', items: { type: 'object' } },
        scopeSelector: { type: 'string' },
        waitSelector: { type: 'string' },
        waitFor: { type: 'string' },
        waitTimeout: { type: 'number' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['candidates'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.EXPAND_SECTION,
    description: '展开通用的折叠区域，并等待指定的内容选择器出现。',
    inputSchema: {
      type: 'object',
      properties: {
        trigger: { type: 'object' },
        expandedAttribute: { type: 'string' },
        contentSelector: { type: 'string' },
        waitTimeout: { type: 'number' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['trigger', 'contentSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SCAN_FOR_SECTION,
    description: '滚动查找指定区域，可选择向上复扫；仅返回遍历状态，不包含平台业务规则。',
    inputSchema: {
      type: 'object',
      properties: {
        targetSelector: { type: 'string' },
        stopSelector: { type: 'string' },
        direction: { type: 'string', enum: ['down', 'up'] },
        step: { type: 'number' },
        maxSteps: { type: 'number' },
        rescanUpSteps: { type: 'number' },
        waitAfterScrollMs: { type: 'number' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['targetSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PAGINATE_EXTRACT,
    description: '先抽取当前页，再点击指定的下一页候选项；仅在卡片 HTML 发生变化后继续。',
    inputSchema: {
      type: 'object',
      properties: {
        cardSelector: { type: 'string' },
        next: { type: 'object' },
        fields: { type: 'array', items: { type: 'object' } },
        expectedCount: { type: 'number' },
        pageSize: { type: 'number' },
        maxPages: { type: 'number' },
        changeMode: { type: 'string', enum: ['card_html_hash'] },
        waitTimeout: { type: 'number' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['cardSelector', 'next', 'fields'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.EXTRACT_RECORDS,
    description: '从卡片中抽取调用方指定的原始字段，并按不区分大小写的文本规则排除记录。',
    inputSchema: {
      type: 'object',
      properties: {
        cardSelector: { type: 'string' },
        fields: { type: 'array', items: { type: 'object' } },
        excludeIfTextMatches: { type: 'array', items: { type: 'string' } },
        includeOuterHtml: { type: 'boolean' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['cardSelector', 'fields'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.DETECT_EMPTY_STATE,
    description: '根据指定选择器和文本标记返回 has_content、empty 或 loading_or_unknown。',
    inputSchema: {
      type: 'object',
      properties: {
        contentSelector: { type: 'string' },
        emptyTextMarkers: { type: 'array', items: { type: 'string' } },
        countSelector: { type: 'string' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
        frameSelector: { type: 'string' },
      },
      required: ['contentSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.MERGE_RECORDS,
    description: '按调用方提供的身份字段和数据源优先级纯数据合并；不读取浏览器状态，也不持久化。',
    inputSchema: {
      type: 'object',
      properties: {
        sources: { type: 'array', items: { type: 'object' } },
        identityFields: { type: 'array', items: { type: 'string' } },
        textNormalize: { type: 'boolean' },
        dateToleranceDays: { type: 'number' },
        fieldPriority: { type: 'object' },
        allowSourceOnlyRecords: { type: 'boolean' },
      },
      required: ['sources', 'identityFields'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.LIST_FRAMES,
    description: '列出标签页中的框架，以便作用域操作通过 frameId 定位同源或跨域 iframe。',
    inputSchema: {
      type: 'object',
      properties: { tabId: { type: 'number', description: '目标标签页 ID。' } },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.DIAGNOSTIC_SNAPSHOT,
    description: '返回标签页的一组诊断信息：视口截图、DOM 快照、控制台缓冲和当前网络捕获摘要。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '目标标签页 ID。' },
        domLimit: {
          type: 'number',
          description: '最大 DOM 字符数（默认 50000，上限 250000）。',
        },
        consoleLimit: {
          type: 'number',
          description: '最大控制台条目数（默认 100，上限 500）。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PROXY_DIAGNOSTICS,
    description:
      '读取代理配置及 Chrome 接管状态；action 为 test 时还会验证代理出口。不会返回用户名或密码。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'test'],
          description: 'status 只读取状态；test 还会验证代理出口 IP。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PROXY_ROTATE,
    description:
      '当调用方确认当前标签页异常时，轮换代理会话并重新加载该页面。需要已启用代理；不会返回用户名或密码。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '目标标签页 ID；默认为当前激活标签页。' },
        reason: {
          type: 'string',
          minLength: 1,
          description: '调用方认为当前页面异常的原因。',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SCOPED_ACTION,
    description:
      '在一个语义作用域内点击、抽取或分页；支持开放的 Shadow DOM，并可用 frameId 指定同源或跨域 iframe。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['click', 'extract', 'paginate'] },
        scopeSelector: {
          type: 'string',
          description: '所属区域的 CSS 选择器，例如评论区。',
        },
        selector: { type: 'string', description: '作用域内的 CSS 选择器。' },
        text: { type: 'string', description: '点击时可选的可见文本过滤条件。' },
        role: { type: 'string', description: '点击时可选的 ARIA 角色过滤条件。' },
        frameId: { type: 'number', description: '来自 Chrome 框架检查的框架 ID。' },
        tabId: { type: 'number', description: '目标标签页 ID。' },
        itemSelector: { type: 'string', description: '分页用：作用域内的条目选择器。' },
        nextSelector: {
          type: 'string',
          description: '分页用：作用域内的下一页控件选择器。',
        },
        stopSelector: {
          type: 'string',
          description: '分页用：出现此选择器时停止。',
        },
        maxPages: {
          type: 'number',
          description: '分页用：最大页数（默认 50，上限 200）。',
        },
        timeout: {
          type: 'number',
          description: '分页用：每页 DOM 变化的超时时间（毫秒）。',
        },
      },
      required: ['action', 'scopeSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.TASK_CONTEXT,
    description: '创建隔离的无痕任务窗口，并在 MCP 重启后保存其标签页和调用方定义的抓取状态。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'get', 'save', 'clear', 'close'] },
        taskId: { type: 'string', description: '调用方定义的稳定任务 ID。' },
        url: { type: 'string', description: '创建时的初始 URL。' },
        state: {
          type: 'object',
          description: 'JSON 安全的状态，例如商品 ID 和当前评论页。',
        },
      },
      required: ['action', 'taskId'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_WINDOWS_AND_TABS,
    description: '列出当前打开的所有浏览器窗口和标签页。',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CREATE_TAB,
    description: '新建浏览器标签页，可指定 URL、窗口、前台/后台状态和固定状态。',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '新标签页打开的 URL；省略时打开新标签页。' },
        windowId: { type: 'number', description: '将标签页创建到指定窗口。' },
        active: {
          type: 'boolean',
          description: '是否激活新标签页；与 background 同时提供时 active 优先。',
        },
        background: { type: 'boolean', description: '是否后台打开；true 等价于 active=false。' },
        pinned: { type: 'boolean', description: '是否将新标签页固定。' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HOVER,
    description: '通过 CSS 或 XPath 选择器将鼠标悬停在页面元素上。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '目标元素的 CSS 或 XPath 选择器。' },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: '选择器类型，默认为 css。',
        },
        tabId: { type: 'number', description: '目标标签页 ID；省略时使用当前激活标签页。' },
        windowId: { type: 'number', description: '未提供 tabId 时用于选取激活标签页的窗口 ID。' },
        durationMs: { type: 'number', description: '保持悬停的时间（毫秒，默认 250）。' },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PRINT_TO_PDF,
    description: '使用 CDP Page.printToPDF 将页面打印为 PDF，支持页面 CSS 尺寸和自定义纸张尺寸。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '目标标签页 ID；省略时使用当前激活标签页。' },
        windowId: { type: 'number', description: '未提供 tabId 时用于选取激活标签页的窗口 ID。' },
        pageSize: {
          type: 'string',
          enum: ['page', 'A3', 'A4', 'A5', 'Letter', 'Legal', 'Tabloid', 'custom'],
          description: '纸张尺寸；page 使用页面 CSS 尺寸，custom 使用 paperWidth/paperHeight。',
        },
        paperSize: { type: 'string', description: 'pageSize 的兼容别名。' },
        paperWidth: {
          type: 'number',
          description: '自定义纸张宽度，单位为英寸，需与 paperHeight 一起提供。',
        },
        paperHeight: {
          type: 'number',
          description: '自定义纸张高度，单位为英寸，需与 paperWidth 一起提供。',
        },
        landscape: { type: 'boolean', description: '是否横向打印。' },
        printBackground: { type: 'boolean', description: '是否打印背景图形，默认为 true。' },
        preferCSSPageSize: { type: 'boolean', description: '是否优先使用页面 CSS @page 尺寸。' },
        scale: { type: 'number', description: '打印缩放比例。' },
        marginTop: { type: 'number', description: '上边距，单位为英寸。' },
        marginBottom: { type: 'number', description: '下边距，单位为英寸。' },
        marginLeft: { type: 'number', description: '左边距，单位为英寸。' },
        marginRight: { type: 'number', description: '右边距，单位为英寸。' },
        pageRanges: { type: 'string', description: '要打印的页码范围，例如 1-3。' },
        displayHeaderFooter: { type: 'boolean', description: '是否显示页眉和页脚。' },
        headerTemplate: { type: 'string', description: '页眉 HTML 模板。' },
        footerTemplate: { type: 'string', description: '页脚 HTML 模板。' },
        savePdf: { type: 'boolean', description: '是否同时保存 PDF 到 Chrome 下载目录。' },
        filename: { type: 'string', description: '保存 PDF 时使用的文件名。' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_ELEMENT_INFO,
    description: '查询页面元素的 attributes、computed styles 和 bounding rect。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '目标元素的 CSS 或 XPath 选择器。' },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: '选择器类型，默认为 css。',
        },
        tabId: { type: 'number', description: '目标标签页 ID；省略时使用当前激活标签页。' },
        windowId: { type: 'number', description: '未提供 tabId 时用于选取激活标签页的窗口 ID。' },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.STORAGE_GET,
    description: '读取页面的 localStorage 或 sessionStorage。',
    inputSchema: {
      type: 'object',
      properties: {
        storageArea: {
          type: 'string',
          enum: ['local', 'session'],
          description: '存储区域，默认为 local。',
        },
        key: { type: 'string', description: '要读取的键；省略时读取全部键。' },
        keys: { type: 'array', items: { type: 'string' }, description: '要读取的多个键。' },
        tabId: { type: 'number', description: '目标标签页 ID；省略时使用当前激活标签页。' },
        windowId: { type: 'number', description: '未提供 tabId 时用于选取激活标签页的窗口 ID。' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.STORAGE_SET,
    description: '写入页面的 localStorage 或 sessionStorage；值会按 JSON 序列化。',
    inputSchema: {
      type: 'object',
      properties: {
        storageArea: {
          type: 'string',
          enum: ['local', 'session'],
          description: '存储区域，默认为 local。',
        },
        key: { type: 'string', description: '要写入的键。' },
        value: { description: '要写入的值；字符串原样保存，其他值 JSON 序列化。' },
        items: { type: 'object', description: '批量写入的键值对象；与 key/value 二选一。' },
        tabId: { type: 'number', description: '目标标签页 ID；省略时使用当前激活标签页。' },
        windowId: { type: 'number', description: '未提供 tabId 时用于选取激活标签页的窗口 ID。' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.STORAGE_DELETE,
    description: '删除页面的 localStorage 或 sessionStorage 键。',
    inputSchema: {
      type: 'object',
      properties: {
        storageArea: {
          type: 'string',
          enum: ['local', 'session'],
          description: '存储区域，默认为 local。',
        },
        key: { type: 'string', description: '要删除的键。' },
        keys: { type: 'array', items: { type: 'string' }, description: '要删除的多个键。' },
        tabId: { type: 'number', description: '目标标签页 ID；省略时使用当前激活标签页。' },
        windowId: { type: 'number', description: '未提供 tabId 时用于选取激活标签页的窗口 ID。' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COOKIE_GET,
    description: '获取浏览器 Cookie，可按 URL、域名、名称或 Cookie 存储分区筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '仅返回适用于此 URL 的 Cookie。' },
        domain: { type: 'string', description: '仅返回此域名下的 Cookie。' },
        name: { type: 'string', description: '仅返回此名称的 Cookie。' },
        storeId: {
          type: 'string',
          description: '仅返回此浏览器配置存储分区中的 Cookie。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COOKIE_SET,
    description: '设置浏览器 Cookie，支持 HttpOnly、Secure、SameSite、路径和过期时间。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Cookie 所属域名下的 URL；Chrome 设置 Cookie 时必填。',
        },
        name: { type: 'string', description: 'Cookie 名称。' },
        value: { type: 'string', description: 'Cookie 值。' },
        domain: {
          type: 'string',
          description: '可选的 Cookie 域名；必须与 URL 主机匹配。',
        },
        path: { type: 'string', description: 'Cookie 路径（默认：/）。' },
        secure: { type: 'boolean', description: '仅通过 HTTPS 发送。' },
        httpOnly: { type: 'boolean', description: '对页面 JavaScript 隐藏。' },
        sameSite: {
          type: 'string',
          enum: ['no_restriction', 'lax', 'strict', 'unspecified'],
          description: 'SameSite 策略。',
        },
        expirationDate: {
          type: 'number',
          description: 'Unix 时间戳（秒）；省略则为会话 Cookie。',
        },
        storeId: { type: 'string', description: '浏览器配置存储分区 ID。' },
      },
      required: ['url', 'name', 'value'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COOKIE_DELETE,
    description: '按 URL 和名称删除 Cookie。',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '与要删除 Cookie 匹配的 URL。' },
        name: { type: 'string', description: 'Cookie 名称。' },
        storeId: { type: 'string', description: '浏览器配置存储分区 ID。' },
      },
      required: ['url', 'name'],
    },
  },
  {
    name: 'search_tabs_content',
    description: '使用语义相似度搜索显式选定的浏览器标签页中的可读内容；选定标签页按需建立索引。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '要搜索的文本或主题。' },
        tabIds: {
          type: 'array',
          items: { type: 'number' },
          description: '要搜索的 1 到 5 个标签页 ID。',
        },
        limit: {
          type: 'number',
          description: '最多返回的匹配标签页数量（默认 10，上限 20）。',
        },
      },
      required: ['query', 'tabIds'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_START_TRACE,
    description: '在所选页面上开始性能追踪记录；可选自动刷新页面和/或在短暂时间后自动停止。',
    inputSchema: {
      type: 'object',
      properties: {
        reload: {
          type: 'boolean',
          description: '决定追踪开始后是否自动刷新页面（忽略缓存）。',
        },
        autoStop: {
          type: 'boolean',
          description: '决定是否自动停止追踪（默认 false）。',
        },
        durationMs: {
          type: 'number',
          description: 'autoStop 为 true 时的自动停止时长（毫秒，默认 5000）。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_STOP_TRACE,
    description: '停止所选页面正在进行的性能追踪记录。',
    inputSchema: {
      type: 'object',
      properties: {
        saveToDownloads: {
          type: 'boolean',
          description: '是否将追踪结果保存为下载目录中的 JSON 文件（默认 true）。',
        },
        filenamePrefix: {
          type: 'string',
          description: '下载的追踪 JSON 文件名的可选前缀。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_ANALYZE_INSIGHT,
    description:
      '提供最近一次追踪记录的轻量摘要；如需深入洞察（CWV、明细），请集成原生侧 DevTools 追踪引擎。',
    inputSchema: {
      type: 'object',
      properties: {
        insightName: {
          type: 'string',
          description:
            '供后续深入分析使用的可选洞察名称（例如 "DocumentLatency"）；目前仅作信息记录。',
        },
        timeoutMs: {
          type: 'number',
          description: '通过原生宿主进行深入分析的超时时间（毫秒），默认 60000；大型追踪可调大。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.READ_PAGE,
    description:
      '获取页面上可见元素的无障碍树表示；仅返回视口中可见的元素，可选只筛选交互元素。\n提示：如果返回的元素不包含所需的具体元素，请使用 computer 工具的截图（action="screenshot"）获取该元素的屏幕坐标，再按坐标操作。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            '可选 URL；提供后先导航到该 URL，再读取目标标签页。省略时读取当前目标标签页。',
        },
        maxOutputBytes: {
          type: 'number',
          description: '限制返回 JSON 大小，默认 24000，最大 200000；超限时返回截断元数据。',
        },
        filter: {
          type: 'string',
          description: '元素筛选："interactive" 表示仅按钮/链接/输入框等（默认：所有可见元素）',
        },
        depth: {
          type: 'number',
          description: '最大 DOM 遍历深度（整数 >= 0）；值越小输出越小、性能越好。',
        },
        refId: {
          type: 'string',
          description:
            '聚焦于以该元素 refId（例如 "ref_12"）为根的子树；refId 必须来自同一标签页最近的 chrome_read_page 响应（引用可能过期）。',
        },
        tabId: {
          type: 'number',
          description: '按 ID 指定现有标签页（默认：当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COMPUTER,
    description:
      '使用鼠标和键盘与浏览器交互，并可截图。\n* 每当要点击图标等元素时，应先通过 read_page 确定该元素的 ref，再移动光标。\n* 如果点击程序或链接后等待很久仍未加载成功，先截图，再调整点击位置，使光标尖端视觉上落在要点击的元素上。\n* 点击按钮、链接、图标等时，务必让光标尖端位于元素中心，除非被要求，否则不要点击边缘。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '目标标签页 ID（默认：当前激活标签页）' },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选择活动标签页的窗口 ID。',
        },
        background: {
          type: 'boolean',
          description:
            '对某些操作尽量避免聚焦/激活标签页或窗口（尽力而为）。默认 true；仅当需要前台交互时才设为 false。',
        },
        action: {
          type: 'string',
          description:
            '要执行的操作：left_click | right_click | double_click | triple_click | left_click_drag | scroll | scroll_to | type | key | fill | fill_form | hover | wait | resize_page | zoom | screenshot',
        },
        ref: {
          type: 'string',
          description:
            '来自 chrome_read_page 的元素引用；提供时用于 click/scroll/scroll_to/key/type 及拖拽终点，优先于坐标。',
        },
        coordinates: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X 坐标' },
            y: { type: 'number', description: 'Y 坐标' },
          },
          description:
            '操作使用的坐标（若近期截过图则基于截图坐标空间，否则为视口坐标）。click/scroll 必需，拖拽时作为终点。',
        },
        startCoordinates: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          description: '拖拽操作的起始坐标',
        },
        startRef: {
          type: 'string',
          description: '来自 chrome_read_page 的拖拽起点引用（startCoordinates 的替代）。',
        },
        scrollDirection: {
          type: 'string',
          description: '滚动方向：up | down | left | right',
        },
        scrollAmount: {
          type: 'number',
          description: '滚动格数（1-10），默认 3',
        },
        text: {
          type: 'string',
          description:
            '要输入的文本（action=type），或用空格分隔的按键/组合键（action=key，例如 "Backspace Enter" 或 "cmd+a"）',
        },
        repeat: {
          type: 'number',
          description: 'action=key 时：按键序列的重复次数（整数 1-100，默认 1）。',
        },
        modifiers: {
          type: 'object',
          description: '点击操作（left_click/right_click/double_click/triple_click）使用的修饰键。',
          properties: {
            altKey: { type: 'boolean' },
            ctrlKey: { type: 'boolean' },
            metaKey: { type: 'boolean' },
            shiftKey: { type: 'boolean' },
          },
        },
        region: {
          type: 'object',
          description:
            'action=zoom 时：要采集的矩形区域 (x0,y0)-(x1,y1)，单位为视口像素（若存在近期截图上下文则为截图坐标空间）。',
          properties: {
            x0: { type: 'number' },
            y0: { type: 'number' },
            x1: { type: 'number' },
            y1: { type: 'number' },
          },
          required: ['x0', 'y0', 'x1', 'y1'],
        },
        // For action=fill
        selector: {
          type: 'string',
          description:
            '用于 fill 或 scroll_to 的 CSS 选择器（ref 的替代）；scroll_to 也可用 text 定位。',
        },
        value: {
          oneOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'number' }],
          description: 'action=fill 时设置的值（字符串 | 布尔值 | 数字）',
        },
        elements: {
          type: 'array',
          description: 'action=fill_form 时：要填写的元素列表（ref + value）',
          items: {
            type: 'object',
            properties: {
              ref: { type: 'string', description: '来自 chrome_read_page 的元素引用' },
              value: { type: 'string', description: '要设置的值（非字符串时转为字符串）' },
            },
            required: ['ref', 'value'],
          },
        },
        width: { type: 'number', description: 'action=resize_page 时：视口宽度' },
        height: { type: 'number', description: 'action=resize_page 时：视口高度' },
        appear: {
          type: 'boolean',
          description: 'action=wait（带 text）时：是等待文本出现（true，默认）还是消失（false）',
        },
        timeout: {
          type: 'number',
          description: 'action=wait（带 text）时：超时时间（毫秒，默认 10000，上限 120000）',
        },
        duration: {
          type: 'number',
          description: 'action=wait 的等待秒数（最长 30 秒）',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.POST_TO_X,
    description:
      '在已登录的 X/Twitter 页面发布一条文本帖子。工具会等待编辑框、填充并回读验证文本、等待发布按钮可用、点击一次，然后等待新的成功标记。发布结果明确返回 published、failed 或 unknown；unknown 时不会自动重试，以避免重复发帖。支持自定义选择器以兼容 X 的页面变体。',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要发布的帖子正文。工具不会自动重试。',
        },
        editorSelector: {
          type: 'string',
          description:
            '可选的编辑框 CSS 选择器；默认兼容 X 的 tweetTextarea 和 contenteditable 编辑框。',
        },
        submitSelector: {
          type: 'string',
          description: '可选的发布按钮 CSS 选择器；默认使用 X 的 tweetButtonInline/tweetButton。',
        },
        successSelector: {
          type: 'string',
          description: '可选的发布成功标记 CSS 选择器；默认观察 X 的 toast 或 role=status 元素。',
        },
        successText: {
          type: 'string',
          description: '可选的成功标记文本；提供后会要求新出现的标记包含该文本。',
        },
        timeout: {
          type: 'number',
          description: '每个阶段的最大等待时间（毫秒，默认 20000，最大 120000）。',
        },
        tabId: {
          type: 'number',
          description: '目标 X 标签页 ID；省略时使用当前活动标签页。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时，用于选择活动标签页的窗口 ID。',
        },
      },
      required: ['text'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.USERSCRIPT,
    description:
      '管理浏览器用户脚本：创建、查询、启用、停用、更新、删除、导出脚本，或向已安装脚本发送命令。高风险工具，启用审批策略后需要显式批准。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'create',
            'list',
            'get',
            'enable',
            'disable',
            'update',
            'remove',
            'send_command',
            'export',
          ],
          description: '要执行的用户脚本操作。',
        },
        args: {
          type: 'object',
          description:
            '操作参数。create/update 使用 script、name、matches、world 等字段；get/enable/disable/remove/send_command 使用 id。',
          properties: {
            id: { type: 'string', description: '用户脚本 ID。' },
            script: { type: 'string', description: 'JS、CSS 或 Tampermonkey 脚本源码。' },
            name: { type: 'string', description: '用户脚本名称。' },
            description: { type: 'string', description: '用户脚本描述。' },
            matches: {
              type: 'array',
              items: { type: 'string' },
              description: '要应用脚本的页面匹配模式。',
            },
            excludes: {
              type: 'array',
              items: { type: 'string' },
              description: '不应用脚本的页面匹配模式。',
            },
            persist: { type: 'boolean', description: '是否持久保存脚本，默认 true。' },
            runAt: {
              type: 'string',
              enum: ['document_start', 'document_end', 'document_idle', 'auto'],
              description: '脚本注入时机。',
            },
            world: {
              type: 'string',
              enum: ['auto', 'ISOLATED', 'MAIN'],
              description: '脚本执行环境。',
            },
            allFrames: { type: 'boolean', description: '是否注入所有框架，默认 true。' },
            mode: {
              type: 'string',
              enum: ['auto', 'css', 'persistent', 'once'],
              description: '注入策略；once 只执行一次且不持久保存。',
            },
            dnrFallback: { type: 'boolean', description: '必要时是否使用 DNR 回退，默认 true。' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '用户脚本标签。',
            },
            query: { type: 'string', description: 'list 操作的名称/描述搜索词。' },
            status: {
              type: 'string',
              enum: ['enabled', 'disabled'],
              description: 'list 操作的启用状态筛选。',
            },
            domain: { type: 'string', description: 'list 操作的域名筛选。' },
            payload: { description: 'send_command 操作发送给脚本的任意 JSON 负载。' },
            tabId: { type: 'number', description: 'send_command 操作的目标标签页 ID。' },
          },
          additionalProperties: true,
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.NAVIGATE,
    description: '打开 URL、刷新当前标签页，或在浏览历史中前进/后退',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要打开的 URL。特殊值："back" 或 "forward" 用于在目标标签页中浏览历史。',
        },
        newWindow: {
          type: 'boolean',
          description: '是否新建窗口打开该 URL。默认为 false',
        },
        tabId: {
          type: 'number',
          description:
            '按 ID 指定现有标签页（若提供，则对该标签页执行导航/刷新/后退/前进，而非当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description:
            '按 ID 指定现有窗口（在现有窗口中新建标签页，或在未提供 tabId 时选取激活标签页）。',
        },
        background: {
          type: 'boolean',
          description: '执行操作时不抢占焦点。默认 true；仅当需要前台交互时才设为 false。',
        },
        activateTab: {
          type: 'boolean',
          description:
            'background=true 时，保持目标标签页在其窗口内激活，但不聚焦该窗口。适用于必须继续渲染虚拟化内容的页面。',
        },
        width: {
          type: 'number',
          description: '窗口宽度（像素，默认 1280）。提供宽度或高度时将新建窗口。',
        },
        height: {
          type: 'number',
          description: '窗口高度（像素，默认 720）。提供宽度或高度时将新建窗口。',
        },
        refresh: {
          type: 'boolean',
          description: '刷新当前激活标签页而非打开 URL。为 true 时忽略 url 参数。默认为 false',
        },
        waitForReady: {
          type: 'boolean',
          description:
            '是否等待标签页加载完成后再返回。默认为 true；设为 false 可快速返回，适合后续自行等待或读取页面的场景。',
        },
        waitTimeoutMs: {
          type: 'number',
          minimum: 0,
          maximum: 30000,
          description: '等待标签页加载完成的最大时间（毫秒），默认 15000，最大 30000。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SCREENSHOT,
    description:
      '[优先使用 read_page 而非截图，并优先使用 chrome_computer] 截取当前页面或指定元素的截图。新用法请使用 chrome_computer 的 action="screenshot"；需要高级选项时再使用本工具。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '截图名称（保存为 PNG 时使用）' },
        selector: { type: 'string', description: '要截图的元素的 CSS 选择器' },
        tabId: {
          type: 'number',
          description: '采集来源的目标标签页 ID（默认：当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '未提供 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
        background: {
          type: 'boolean',
          description:
            '尝试不将标签页/窗口置于前台进行采集。简单视口采集使用基于 CDP 的方式；元素/整页采集时标签页可能仍会在其窗口内激活，但不聚焦窗口。默认 false',
        },
        width: { type: 'number', description: '宽度（像素，默认 800）' },
        height: { type: 'number', description: '高度（像素，默认 600）' },
        storeBase64: {
          type: 'boolean',
          description: '以 base64 格式返回截图（默认 false）；若想查看页面，建议设为 true',
        },
        fullPage: {
          type: 'boolean',
          description: '保存整页截图（默认 true）',
        },
        savePng: {
          type: 'boolean',
          description:
            '保存截图 PNG 文件（默认 true）；若想查看页面，建议设为 false 并将 storeBase64 设为 true',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CLOSE_TABS,
    description: '关闭一个或多个浏览器标签页',
    inputSchema: {
      type: 'object',
      properties: {
        tabIds: {
          type: 'array',
          items: { type: 'number' },
          description: '要关闭的标签页 ID 数组。未提供时关闭当前激活标签页。',
        },
        url: {
          type: 'string',
          description: '关闭匹配该 URL 的标签页。可替代 tabIds 使用。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SWITCH_TAB,
    description: '切换到指定浏览器标签页',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: '要切换到的标签页 ID。',
        },
        windowId: {
          type: 'number',
          description: '标签页所在窗口的 ID。',
        },
      },
      required: ['tabId'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.WEB_FETCHER,
    description: '从网页提取 HTML 或文本内容。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要获取内容的 URL。未提供时使用当前激活标签页',
        },
        tabId: {
          type: 'number',
          description: '按 ID 指定现有标签页（默认：当前激活标签页）。',
        },
        background: {
          type: 'boolean',
          description: '获取内容时不激活标签页/聚焦窗口（默认 true）',
        },
        htmlContent: {
          type: 'boolean',
          description: '获取页面可见 HTML 内容。为 true 时忽略 textContent（默认 false）',
        },
        textContent: {
          type: 'boolean',
          description: '获取页面可见文本内容及元数据。htmlContent 为 true 时忽略（默认 true）',
        },

        selector: {
          type: 'string',
          description: '用于获取指定元素内容的 CSS 选择器。提供后仅返回该元素的内容',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.NETWORK_REQUEST,
    description: '在浏览器上下文中发送网络请求，携带 Cookie 等浏览器信息',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要发送请求的 URL',
        },
        method: {
          type: 'string',
          description: '使用的 HTTP 方法（默认 GET）',
        },
        headers: {
          type: 'object',
          description: '请求中包含的标头',
        },
        body: {
          type: 'string',
          description: '请求正文（用于 POST、PUT 等）',
        },
        timeout: {
          type: 'number',
          description: '超时时间（毫秒，默认 30000）',
        },
        formData: {
          type: 'object',
          description:
            'multipart/form-data 描述。提供后覆盖 body，并构建带可选文件附件的 FormData。结构：{ fields?: Record<string,string|number|boolean>, files?: Array<{ name: string, fileUrl?: string, filePath?: string, base64Data?: string, filename?: string, contentType?: string }> }。也支持紧凑数组形式：[ [name, fileSpec, filename?], ... ]，其中 fileSpec 可为 url:、file: 或 base64:。',
        },
      },
      required: ['url'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE,
    description:
      '统一网络捕获工具。action="start" 开始，action="stop" 停止并返回结果；needResponseBody=true 时通过 Debugger API 获取响应体（可能与 DevTools 冲突），默认 webRequest 模式较轻量但不含响应体。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop'],
          description: '要执行的操作："start" 开始采集，"stop" 结束并返回结果',
        },
        needResponseBody: {
          type: 'boolean',
          description:
            '为 true 时使用 Debugger API 采集响应正文（默认 false）。仅在需要检查响应内容时使用。',
        },
        url: {
          type: 'string',
          description: '要采集网络请求的 URL。用于 action="start"。未提供时使用当前激活标签页。',
        },
        maxCaptureTime: {
          type: 'number',
          description: '最大采集时长（毫秒，默认 180000）',
        },
        inactivityTimeout: {
          type: 'number',
          description: '无活动后自动停止的时长（毫秒，默认 60000）。设为 0 可禁用。',
        },
        includeStatic: {
          type: 'boolean',
          description: '是否包含图片/脚本/样式等静态资源（默认 false）',
        },
        tabId: {
          type: 'number',
          description: '仅采集此标签页。停止时只停止此标签页，不影响其他采集。',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BLOCK_IMAGES,
    description:
      '使用 Chrome DevTools Protocol 阻止标签页中的图片网络请求。请在导航或刷新前启动以阻止后续图片下载；停止后恢复正常的图片加载。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop'],
          description: '"start" 阻止后续图片请求；"stop" 恢复图片加载',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID。默认为当前激活标签页。',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BLOCK_RESOURCES,
    description:
      '在一个标签页中拦截指定资源类型或 URL 模式。请在导航或刷新前启动；停止后恢复加载。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop'] },
        tabId: { type: 'number', description: '目标标签页 ID；默认为当前激活标签页。' },
        resourceTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['Image', 'Font', 'Media', 'Script', 'Stylesheet', 'XHR', 'Fetch'],
          },
          description: '要阻止的资源类型；默认为 Image。',
        },
        urlPatterns: {
          type: 'array',
          items: { type: 'string' },
          description: '要阻止的 CDP URL 通配符模式，例如 *://*.doubleclick.net/*。',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HANDLE_DOWNLOAD,
    description: '等待浏览器下载完成并返回详情（id、filename、url、state、size）',
    inputSchema: {
      type: 'object',
      properties: {
        filenameContains: { type: 'string', description: '按文件名或 URL 中的子串筛选' },
        timeoutMs: { type: 'number', description: '超时时间（毫秒，默认 60000，上限 300000）' },
        waitForComplete: { type: 'boolean', description: '等待下载完成（默认 true）' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HISTORY,
    description: '读取并搜索 Chrome 浏览历史',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '在历史 URL 和标题中搜索的文本。留空则返回时间范围内的全部历史条目。',
        },
        startTime: {
          type: 'string',
          description:
            '起始时间（日期字符串）。支持 ISO 格式（如 "2023-10-01"、"2023-10-01T14:30:00"）、相对时间（如 "1 day ago"、"2 weeks ago"、"3 months ago"、"1 year ago"）和特殊关键词（"now"、"today"、"yesterday"）。默认：24 小时前',
        },
        endTime: {
          type: 'string',
          description:
            '结束时间（日期字符串）。支持 ISO 格式（如 "2023-10-31"、"2023-10-31T14:30:00"）、相对时间（如 "1 day ago"、"2 weeks ago"、"3 months ago"、"1 year ago"）和特殊关键词（"now"、"today"、"yesterday"）。默认：当前时间',
        },
        maxResults: {
          type: 'number',
          description: '最多返回的历史条目数。用于限制结果以提升性能或聚焦最相关条目（默认 100）。',
        },
        excludeCurrentTabs: {
          type: 'boolean',
          description:
            '为 true 时，过滤掉当前已在任意标签页打开的 URL。适合查找访问过但已关闭的页面（默认 false）',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_SEARCH,
    description: '按标题和 URL 搜索 Chrome 书签',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '用于匹配书签标题和 URL 的搜索词。留空则返回全部书签。',
        },
        maxResults: {
          type: 'number',
          description: '最多返回的书签数量（默认 50）',
        },
        folderPath: {
          type: 'string',
          description:
            '用于限定搜索范围的可选文件夹路径或 ID。可以是路径字符串（如 "Work/Projects"）或文件夹 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_ADD,
    description: '向 Chrome 添加书签，支持指定文件夹。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要收藏的 URL；未提供时使用当前激活标签页的 URL。',
        },
        title: {
          type: 'string',
          description: '书签标题；未提供时使用该 URL 的页面标题。',
        },
        parentId: {
          type: 'string',
          description:
            '书签要加入的父文件夹路径或 ID（如 "Work/Projects" 或文件夹 ID）。未提供时添加到"书签栏"。',
        },
        createFolder: {
          type: 'boolean',
          description: '父文件夹不存在时是否自动创建（默认 false）',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_DELETE,
    description: '按 ID 或 URL 从 Chrome 删除书签。',
    inputSchema: {
      type: 'object',
      properties: {
        bookmarkId: {
          type: 'string',
          description: '要删除的书签 ID；bookmarkId 和 url 必须提供其一。',
        },
        url: {
          type: 'string',
          description: '要删除的书签 URL；未提供 bookmarkId 时使用。',
        },
        title: {
          type: 'string',
          description: '按 URL 删除时的书签标题，用于辅助匹配。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.JAVASCRIPT,
    description:
      '在浏览器标签页中执行 JavaScript 代码并返回结果。使用 CDP Runtime.evaluate（awaitPromise + returnByValue）；调试器忙碌时自动回退到 chrome.scripting.executeScript。输出默认经过脱敏处理并截断。',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            '要执行的 JavaScript 代码（参数名是 code，不是 script）。在 async 函数体内运行，支持顶层 await；显式 return 或末尾表达式/IIFE 都会返回值。省略 tabId 时优先使用最近操作的标签页，没有历史目标时才使用当前激活标签页。',
        },
        tabId: {
          type: 'number',
          description:
            '目标标签页 ID；省略时优先使用最近操作的标签页，没有历史目标时使用当前激活标签页。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
        timeoutMs: {
          type: 'number',
          description: '执行超时时间（毫秒，默认 15000）。',
        },
        maxOutputBytes: {
          type: 'number',
          description: '脱敏后允许的最大输出字节数（默认 51200）；超出部分会被截断。',
        },
        requireResult: {
          type: 'boolean',
          description:
            '是否要求脚本必须返回值。为 true 时，以 undefined 结束的脚本返回 no_result 错误；默认 false 允许纯操作脚本成功。',
        },
      },
      required: ['code'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.LOCATE_ELEMENT,
    description:
      '定位网页元素并返回当前有效的 ref、selector、坐标和元素信息。支持已保存的 markerId/markerName、旧 ref、CSS/XPath、文本、ARIA role、aria-label、data-testid 和 name；定位时可自动滚动并高亮目标。返回的 ref 可直接传给 chrome_click_element 或 chrome_fill_or_select。',
    inputSchema: {
      type: 'object',
      properties: {
        markerId: {
          type: 'string',
          description:
            '已保存的元素标记 ID。优先从 chrome_read_page 返回的 markedElements.id 获取。',
        },
        markerName: {
          type: 'string',
          description: '已保存的元素标记名称。',
        },
        ref: {
          type: 'string',
          description: '来自 chrome_read_page 或此前定位结果的元素引用。失效时会返回明确错误。',
        },
        selector: {
          type: 'string',
          description: 'CSS 选择器或 XPath。',
        },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'selector 的类型，默认 css。',
        },
        text: {
          type: 'string',
          description: '元素可访问名称或可见文本，支持模糊匹配。',
        },
        role: {
          type: 'string',
          description: 'ARIA role 或原生元素推断出的 role，例如 button、textbox、link。',
        },
        ariaLabel: {
          type: 'string',
          description: 'aria-label 的精确值或不区分大小写的匹配值。',
        },
        testId: {
          type: 'string',
          description: 'data-testid、data-test、data-qa 或 data-cy 的值。',
        },
        name: {
          type: 'string',
          description: '表单元素 name 属性的值。',
        },
        allowMultiple: {
          type: 'boolean',
          description: '允许多个匹配时返回第一个并报告匹配数量，默认 false。',
        },
        scrollIntoView: {
          type: 'boolean',
          description: '是否将目标滚动到视口中央，默认 true。',
        },
        highlight: {
          type: 'boolean',
          description: '是否在页面上短暂高亮目标，默认 true。',
        },
        timeout: {
          type: 'number',
          description: '等待目标出现的最长时间（毫秒），默认 5000。',
        },
        tabId: { type: 'number', description: '目标标签页 ID。' },
        windowId: { type: 'number', description: '未指定 tabId 时用于选择活动标签页的窗口 ID。' },
        frameId: { type: 'number', description: '目标 iframe 的 Chrome frame ID。' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SELECT_ALL_ITEMS,
    description:
      '对懒加载或虚拟列表执行安全的选择全部：滚动到底部，等待卡片数量连续稳定若干轮，并逐个操作每张卡片内的 checkbox。不会依赖页面自身可能失效的“选择全部”按钮，也不会把乐观 DOM 数量当成服务端删除成功。',
    inputSchema: {
      type: 'object',
      properties: {
        cardSelector: {
          type: 'string',
          description: '每个列表卡片的 CSS 选择器。',
        },
        checkboxSelector: {
          type: 'string',
          description: '卡片内部 checkbox 的 CSS 选择器，例如 input[type="checkbox"]。',
        },
        containerSelector: {
          type: 'string',
          description: '可选的滚动容器；不填时使用页面滚动条。',
        },
        step: { type: 'number', description: '每轮滚动像素，默认 500。' },
        settleMs: { type: 'number', description: '每轮滚动后等待懒加载的毫秒数，默认 500。' },
        stableRounds: { type: 'number', description: '底部列表连续稳定轮数，默认 3。' },
        maxRounds: { type: 'number', description: '最大滚动轮数，默认 200。' },
        maxDurationMs: { type: 'number', description: '最大执行时间，默认 120000 毫秒。' },
        restoreScroll: { type: 'boolean', description: '完成后是否恢复原滚动位置，默认 false。' },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
      },
      required: ['cardSelector', 'checkboxSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CLICK,
    description:
      '点击网页元素。支持已保存的 markerId/markerName、CSS 选择器、XPath、元素引用（来自 chrome_read_page）或视口坐标。markerId 会在点击前重新定位目标。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '要点击元素的 CSS 选择器或 XPath。',
        },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: '选择器类型（默认 "css"）。',
        },
        markerId: { type: 'string', description: '已保存的元素标记 ID。' },
        markerName: {
          type: 'string',
          description: '已保存的元素标记名称；匹配多个标记时请改用 markerId。',
        },
        ref: {
          type: 'string',
          description: '来自 chrome_read_page 的元素引用（优先于 selector）。',
        },
        coordinates: {
          type: 'object',
          description: '要点击的视口坐标。',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
        double: {
          type: 'boolean',
          description: '为 true 时执行双击（默认 false）。',
        },
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: '要点击的鼠标按键（默认 "left"）。',
        },
        modifiers: {
          type: 'object',
          description: '点击时按住的修饰键。',
          properties: {
            altKey: { type: 'boolean' },
            ctrlKey: { type: 'boolean' },
            metaKey: { type: 'boolean' },
            shiftKey: { type: 'boolean' },
          },
        },
        waitForNavigation: {
          type: 'boolean',
          description: '点击后是否等待导航完成（默认 false）。',
        },
        timeout: {
          type: 'number',
          description: '等待超时时间（毫秒，默认 5000）。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID；省略时使用当前激活标签页。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选择激活标签页的窗口 ID。',
        },
        frameId: {
          type: 'number',
          description: '用于 iframe 支持的目标框架 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.FILL,
    description:
      '填写或选择网页表单元素。支持 input、textarea、select、checkbox 和 radio。可使用 markerId/markerName、CSS 选择器、XPath 或元素引用定位；标记会在输入前重新解析。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '表单元素的 CSS 选择器或 XPath。',
        },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: '选择器类型（默认 "css"）。',
        },
        markerId: { type: 'string', description: '已保存的元素标记 ID。' },
        markerName: {
          type: 'string',
          description: '已保存的元素标记名称；匹配多个标记时请改用 markerId。',
        },
        ref: {
          type: 'string',
          description: '来自 chrome_read_page 的元素引用（优先于 selector）。',
        },
        value: {
          type: ['string', 'number', 'boolean'],
          description:
            '要填写的值。文本输入框：字符串；复选框/单选：布尔值；下拉框：选项值或文本。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID；省略时使用当前激活标签页。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选择激活标签页的窗口 ID。',
        },
        frameId: {
          type: 'number',
          description: '用于 iframe 支持的目标框架 ID。',
        },
      },
      required: ['value'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.REQUEST_ELEMENT_SELECTION,
    description:
      '请求用户手动选择当前页面上的一个或多个元素。当使用 chrome_read_page 配合 chrome_click_element/chrome_fill_or_select/chrome_computer 尝试约 3 次仍无法可靠定位目标元素时，作为人工介入的回退方案。用户会看到带说明的面板并点击所需元素。返回与 chrome_click_element/chrome_fill_or_select 兼容的元素引用（含跨框架的 iframe frameId）。',
    inputSchema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          description:
            '元素选择请求列表。每个请求产出一个被选元素；用户会在面板中看到请求并逐一点击选择。',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '用于关联的可选稳定请求 ID；省略时自动生成（如 "req_1"）。',
              },
              name: {
                type: 'string',
                description:
                  '向用户展示的简短标签，描述要选择什么元素（如 "登录按钮"、"邮箱输入框"）。',
              },
              description: {
                type: 'string',
                description:
                  '向用户展示的可选详细说明，提供更多上下文（如"点击右上角的主登录按钮"）。',
              },
            },
            required: ['name'],
          },
        },
        timeoutMs: {
          type: 'number',
          description:
            '用户完成所有选择的超时时间（毫秒）。默认 180000（3 分钟），上限 600000（10 分钟）。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID；省略时使用当前激活标签页。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选择激活标签页的窗口 ID。',
        },
      },
      required: ['requests'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_INTERACTIVE_ELEMENTS,
    description:
      '查找页面上可点击和交互的元素。支持按文本模糊搜索、CSS 选择器过滤和元素类型过滤。返回元素的 CSS 选择器、类型、文本、可见性和可点击性等信息。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: '目标标签页 ID。如果省略，使用当前活动标签页。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选择活动标签页的窗口 ID。',
        },
        textQuery: {
          type: 'string',
          description: '在可交互元素中模糊搜索的文本。',
        },
        selector: {
          type: 'string',
          description: 'CSS 选择器，用于过滤可交互元素。',
        },
        includeCoordinates: {
          type: 'boolean',
          description: '是否在响应中包含元素坐标（默认：true）。',
        },
        types: {
          type: 'array',
          items: { type: 'string' },
          description:
            '要包含的可交互元素类型列表。例如：["button", "input", "select", "a", "checkbox", "radio"]。如果省略则包含所有类型。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.KEYBOARD,
    description:
      '模拟网页键盘输入。支持单键（Enter、Tab、Escape）、组合键（Ctrl+C、Ctrl+V）和文本输入。可定位到指定元素或发送给当前聚焦元素。',
    inputSchema: {
      type: 'object',
      properties: {
        keys: {
          type: 'string',
          description:
            '要模拟的按键或组合键。示例："Enter"、"Tab"、"Ctrl+C"、"Shift+Tab"、"Hello World"。',
        },
        selector: {
          type: 'string',
          description: '接收键盘事件的目标元素的 CSS 选择器或 XPath。',
        },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: '选择器类型（默认 "css"）。',
        },
        delay: {
          type: 'number',
          description: '按键之间的延迟（毫秒，默认 50）。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID；省略时使用当前激活标签页。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选择激活标签页的窗口 ID。',
        },
        frameId: {
          type: 'number',
          description: '用于 iframe 支持的目标框架 ID。',
        },
      },
      required: ['keys'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CONSOLE,
    description:
      '采集浏览器标签页的控制台输出。支持快照模式（默认；一次性采集，约等待 2 秒）和缓冲模式（每个标签页的持久缓冲，可即时读取/清空，无需等待）。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要导航并采集控制台的 URL；未提供时使用当前激活标签页',
        },
        tabId: {
          type: 'number',
          description: '按 ID 指定现有标签页（默认：当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
        background: {
          type: 'boolean',
          description: '通过 CDP 采集时不激活标签页/聚焦窗口。默认 true',
        },
        includeExceptions: {
          type: 'boolean',
          description: '输出中是否包含未捕获异常（默认 true）',
        },
        maxMessages: {
          type: 'number',
          description: '快照模式最多采集的控制台消息数（默认 100）。提供 limit 时以 limit 为准。',
        },
        mode: {
          type: 'string',
          enum: ['snapshot', 'buffer'],
          description:
            '控制台采集模式：snapshot（默认；等待约 2 秒收集消息）或 buffer（每个标签页的持久缓冲，从内存即时读取）。',
        },
        buffer: {
          type: 'boolean',
          description: 'mode="buffer" 的别名（默认 false）。',
        },
        clear: {
          type: 'boolean',
          description:
            '仅缓冲模式：读取前清空该标签页的缓冲日志（默认 false）。如需读取后清空，请改用 clearAfterRead（mcp-tools.js 风格）。',
        },
        clearAfterRead: {
          type: 'boolean',
          description:
            '仅缓冲模式：读取后清空该标签页的缓冲日志，避免后续调用重复（默认 false）。与 mcp-tools.js 行为一致。',
        },
        pattern: {
          type: 'string',
          description: '应用于消息/异常文本的可选正则过滤。支持 /pattern/flags 语法。',
        },
        onlyErrors: {
          type: 'boolean',
          description:
            '仅返回错误级别的控制台消息（includeExceptions=true 时含异常）。默认 false。',
        },
        limit: {
          type: 'number',
          description:
            '限制返回的控制台消息数。快照模式下为 maxMessages 的别名；缓冲模式下限制从缓冲返回的消息数。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.FILE_UPLOAD,
    description: '使用 Chrome DevTools Protocol 向带文件输入控件的网页表单上传文件',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '目标标签页 ID（默认：当前激活标签页）' },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID',
        },
        selector: {
          type: 'string',
          description: '文件输入元素（input[type="file"]）的 CSS 选择器',
        },
        filePath: {
          type: 'string',
          description: '要上传的本地文件路径',
        },
        fileUrl: {
          type: 'string',
          description: '上传前要从该 URL 下载的文件',
        },
        base64Data: {
          type: 'string',
          description: '要上传的 Base64 编码文件数据',
        },
        fileName: {
          type: 'string',
          description: '使用 base64 或 URL 时的可选文件名（默认 "uploaded-file"）',
        },
        multiple: {
          type: 'boolean',
          description: '输入控件是否接受多个文件（默认 false）',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PASTE_IMAGE,
    description:
      '将本地图片或图片数据作为合成 paste 事件粘贴到 textarea、input 或 contenteditable 元素。它不读取系统剪贴板；内部使用临时 file input、DataTransfer 和 ClipboardEvent。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '目标标签页 ID（默认：最近操作的标签页）' },
        windowId: { type: 'number', description: '省略 tabId 时用于选取目标标签页的窗口 ID' },
        targetSelector: {
          type: 'string',
          description: '接收 paste 事件的 CSS 选择器；省略时使用当前焦点或页面编辑器',
        },
        selector: {
          type: 'string',
          description: 'targetSelector 的兼容别名',
        },
        filePath: { type: 'string', description: '本地图片文件的绝对路径' },
        fileUrl: { type: 'string', description: '下载后作为图片粘贴的 URL' },
        base64Data: { type: 'string', description: '图片的 Base64 数据，可带 data:image/... 前缀' },
        fileName: { type: 'string', description: 'base64 或 URL 数据使用的文件名' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_FORM_VALUE,
    description:
      '读取表单控件的实际 DOM value，适用于 React/Vue 受控 input 和 textarea；返回值不是 HTML 属性或文本节点。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'input、textarea、select 或 contenteditable 的 CSS 选择器',
        },
        tabId: { type: 'number', description: '目标标签页 ID（默认：最近操作的标签页）' },
        windowId: { type: 'number', description: '省略 tabId 时用于选取目标标签页的窗口 ID' },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HANDLE_DIALOG,
    description: '通过 CDP 处理 JavaScript 和 beforeunload 对话框（alert/confirm/prompt）',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: '接受 | 取消' },
        promptText: {
          type: 'string',
          description: '接受 prompt 对话框时的可选输入文本',
        },
        tabId: {
          type: 'number',
          description: '可选的目标标签页 ID，默认使用当前激活标签页',
        },
        windowId: {
          type: 'number',
          description: '解析当前激活标签页时可选的目标窗口 ID',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GIF_RECORDER,
    description:
      '将浏览器标签页活动录制为 GIF 动画。\n\n模式：\n- 固定帧率模式（action="start"）：按固定间隔采集帧，适合动画/视频。\n- 自动采集模式（action="auto_start"）：chrome_computer 或 chrome_navigate 操作成功时自动采集帧，适合节奏自然的交互录制。\n\n使用 "stop" 结束录制并保存 GIF。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop', 'status', 'auto_start', 'capture', 'clear', 'export'],
          description:
            '要执行的操作：\n- "start"：开始固定帧率录制（按固定间隔采集帧）\n- "auto_start"：开始自动采集模式（工具操作时采集帧）\n- "stop"：结束录制并保存 GIF\n- "status"：获取当前录制状态\n- "capture"：在自动模式下手动触发一次帧采集\n- "clear"：清除全部录制状态和缓存的 GIF（不保存）\n- "export"：导出最近录制的 GIF（下载或拖拽上传）',
        },
        tabId: {
          type: 'number',
          description:
            '目标标签页 ID（默认：当前激活标签页）。"start"/"auto_start" 用于录制；"export"（download=false）用于指定拖拽上传目标。',
        },
        fps: {
          type: 'number',
          description: '固定帧率模式的帧率（1-30，默认 5）。越高越流畅但文件越大。',
        },
        durationMs: {
          type: 'number',
          description: '最大录制时长（毫秒，默认 5000，上限 60000）。仅固定帧率模式。',
        },
        maxFrames: {
          type: 'number',
          description: '最多采集的帧数（固定帧率默认 50，自动模式默认 100，上限 300）。',
        },
        width: {
          type: 'number',
          description: '输出 GIF 宽度（像素，默认 800，上限 1920）。',
        },
        height: {
          type: 'number',
          description: '输出 GIF 高度（像素，默认 600，上限 1080）。',
        },
        maxColors: {
          type: 'number',
          description: '调色板最大颜色数（默认 256）。值越小文件越小。',
        },
        filename: {
          type: 'string',
          description: '输出文件名（不含扩展名）。默认使用时间戳命名。',
        },
        captureDelayMs: {
          type: 'number',
          description: '仅自动采集模式：操作后延迟多少毫秒再采集帧（默认 150），让 UI 稳定。',
        },
        frameDelayCs: {
          type: 'number',
          description: '仅自动采集模式：每帧显示时长（百分之一秒，默认 20 = 每帧 200ms）。',
        },
        annotation: {
          type: 'string',
          description: '仅自动采集模式（action="capture"）：渲染在采集帧上的可选文字标签。',
        },
        download: {
          type: 'boolean',
          description: '仅导出操作：设为 true（默认）下载 GIF，或 false 通过拖拽上传。',
        },
        coordinates: {
          type: 'object',
          description: '仅导出操作（download=false）：拖拽上传的目标坐标。',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
        ref: {
          type: 'string',
          description:
            '仅导出操作（download=false）：拖拽目标的元素引用（来自 chrome_read_page）。',
        },
        selector: {
          type: 'string',
          description: '仅导出操作（download=false）：拖拽目标元素的 CSS 选择器。',
        },
        enhancedRendering: {
          type: 'object',
          description:
            '仅自动采集模式：配置录制操作的视觉效果（点击指示、拖拽轨迹、标签）。传 `true` 启用全部默认效果。',
          properties: {
            clickIndicators: {
              oneOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                      description: '启用点击指示（默认 true）',
                    },
                    color: {
                      type: 'string',
                      description: '点击指示的 CSS 颜色（默认 "rgba(255, 87, 34, 0.8)"）',
                    },
                    radius: { type: 'number', description: '初始半径（像素，默认 20）' },
                    animationDurationMs: {
                      type: 'number',
                      description: '动画时长（毫秒，默认 400）',
                    },
                    animationFrames: {
                      type: 'number',
                      description: '动画帧数（默认 3）',
                    },
                    animationIntervalMs: {
                      type: 'number',
                      description: '动画帧间隔（毫秒，默认 80）',
                    },
                  },
                },
              ],
              description: '点击指示覆盖层配置（true 使用默认值，或传对象自定义）。',
            },
            dragPaths: {
              oneOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                      description: '启用拖拽轨迹渲染（默认 true）',
                    },
                    color: {
                      type: 'string',
                      description: '拖拽轨迹的 CSS 颜色（默认 "rgba(33, 150, 243, 0.7)"）',
                    },
                    lineWidth: { type: 'number', description: '线宽（像素，默认 3）' },
                    lineDash: {
                      type: 'array',
                      items: { type: 'number' },
                      description: '虚线模式（默认 [6, 4]）',
                    },
                    arrowSize: {
                      type: 'number',
                      description: '箭头大小（像素，默认 10）',
                    },
                  },
                },
              ],
              description: '拖拽轨迹覆盖层配置（true 使用默认值，或传对象自定义）。',
            },
            labels: {
              oneOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                      description: '启用操作标签（默认 true）',
                    },
                    font: {
                      type: 'string',
                      description: '标签字体（默认 "bold 12px sans-serif"）',
                    },
                    textColor: { type: 'string', description: '文字颜色（默认 "#fff"）' },
                    bgColor: {
                      type: 'string',
                      description: '背景颜色（默认 "rgba(0,0,0,0.7)"）',
                    },
                    padding: { type: 'number', description: '内边距（像素，默认 4）' },
                    borderRadius: {
                      type: 'number',
                      description: '边框圆角（像素，默认 4）',
                    },
                    offset: {
                      type: 'object',
                      properties: { x: { type: 'number' }, y: { type: 'number' } },
                      description: '相对操作位置的偏移（默认 {x: 10, y: -20}）',
                    },
                  },
                },
              ],
              description: '操作标签覆盖层配置（true 使用默认值，或传对象自定义）。',
            },
            durationMs: {
              type: 'number',
              description: '覆盖层保持可见的时长（毫秒，默认 1500）。',
            },
          },
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_PAGE_TEXT,
    description:
      '使用 Readability 提取页面可读的正文。返回纯净文本、文章 HTML 以及标题、摘要、作者、站点名、语言、长度等元数据。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '可选 CSS 选择器。提供后返回该元素内的文本，而不是 Readability 正文提取。',
        },
        tabId: { type: 'number', description: '目标标签页 ID（默认：当前激活标签页）。' },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SPA_FETCH,
    description:
      '打开 SPA（单页应用）URL，等待 JS 渲染，自动滚动触发懒加载内容，然后提取完整的渲染后文本内容。适用于 X/Twitter、Reddit 等 JS 重页面（普通 HTTP 抓取拿不到有效文本）。\n\n典型用法：传入 url 和 maxScrolls=5-10 调用一次，工具会自动完成滚动和文本提取。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要抓取内容的 SPA 目标 URL。',
        },
        maxScrolls: {
          type: 'number',
          description:
            '最大滚到底部轮数（默认 5）。每轮滚动到底部、等待懒加载内容加载，再提取文本。无限滚动信息流（如 Twitter 时间线）可调大。',
          default: 5,
        },
        scrollDelay: {
          type: 'number',
          description: '滚动步进之间的延迟（毫秒，默认 2000）。延迟越长，动态内容渲染时间越充足。',
          default: 2000,
        },
        waitForSelector: {
          type: 'string',
          description:
            '开始提取前要等待出现的可选 CSS 选择器（如 Twitter 的 "[data-testid="tweet"]"）。省略时等待 body 出现并延迟 2 秒稳定。',
        },
        waitTimeout: {
          type: 'number',
          description: '等待 waitForSelector 出现的最长时间（毫秒，默认 20000）。',
          default: 20000,
        },
        extractHtml: {
          type: 'boolean',
          description: '是否同时返回渲染后的 HTML 内容（默认 false）。默认只返回文本。',
          default: false,
        },
        tabId: {
          type: 'number',
          description: '按 ID 指定现有标签页（默认：新建标签页）。',
        },
        windowId: {
          type: 'number',
          description: '新建或复用标签页的目标窗口 ID。',
        },
        background: {
          type: 'boolean',
          description: '提供 URL 时是否在后台打开；默认 false，会激活目标标签页。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_TAB_URL,
    description:
      '获取指定浏览器标签页的当前 URL 和标题。返回 url、title、tabId 和 favIconUrl。只需当前 URL 时比 get_windows_and_tabs 更简单更快。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: '目标标签页 ID（默认：当前窗口中的激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_SCROLL_STATE,
    description:
      '获取页面或可滚动容器的原生状态。返回 target、y、maxY、atTop 和 atBottom。找不到请求的滚动容器时明确报错。',
    inputSchema: {
      type: 'object',
      properties: {
        containerSelector: {
          type: 'string',
          description: '滚动容器的 CSS 选择器。省略时自动检测主容器。',
        },
        anchorSelector: {
          type: 'string',
          description: '目标滚动容器内内容的可选 CSS 选择器。可改善嵌套或虚拟化列表的自动检测。',
        },
        frameSelector: {
          type: 'string',
          description: '包含滚动容器的同源 iframe 的可选 CSS 选择器。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID（默认：当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SCROLL,
    description:
      '滚动页面或可滚动容器。支持多种滚动模式：\n- 像素滚动：指定 amount（正数=向下/向右）和可选 direction\n- 边缘滚动：设置 toBottom=true 或 toTop=true\n- 元素滚动：设置 selector 将元素滚动到视图中\n省略 containerSelector 时自动检测可见的可滚动容器；anchorSelector 可定位嵌套或虚拟化列表中的内容。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['fast', 'human', 'humanFast', 'humanSlow'],
          description:
            '滚动速度模式：fast（默认）、human（标准真人）、humanFast（快人）或 humanSlow（慢人）。三种真人模式未传 steps/intervalMs 时，步数以 600 像素 = 15 步为基准按距离等比计算，步间隔恒定分别为 50、20、80 毫秒（不随距离变化）。',
        },
        humanLazyLoad: {
          type: 'boolean',
          description:
            '真人懒加载优化。仅 human、humanFast、humanSlow 模式生效；每个分步滚动轮次结束后检测 DOM、布局和网络资源变化，并等待页面加载趋于稳定（默认 false）。',
        },
        amount: {
          type: 'number',
          description:
            '要滚动的像素数。正值向下/向右，负值向上/向左。只设 direction 未设 amount 时，fast 默认 300，三种真人模式默认 600。',
        },
        direction: {
          type: 'string',
          enum: ['down', 'up', 'left', 'right'],
          description: '滚动方向。与 amount 配合使用，否则默认 300 像素。',
        },
        steps: {
          type: 'number',
          description:
            '像素滚动时，将移动拆分为这么多步（fast 默认 1；三种真人模式未传时按 amount 相对 600 等比计算，基准 15 步；上限 50）。',
        },
        intervalMs: {
          type: 'number',
          description:
            '像素滚动时，每步之间等待的毫秒数（fast 默认 0；human、humanFast、humanSlow 未传时恒定分别为 50、20、80 毫秒，不随距离变化；上限 2000）。',
        },
        toBottom: {
          type: 'boolean',
          description:
            '滚动到滚动容器的底部；真人模式下按对应真人速度连续滚动，直到稳定到底部或本次请求达到上限。',
        },
        toTop: {
          type: 'boolean',
          description: '滚动到滚动容器的顶部。',
        },
        selector: {
          type: 'string',
          description: '要滚动到视图中的元素的 CSS 选择器。默认使用 scrollIntoView。',
        },
        scrollIntoView: {
          type: 'boolean',
          description:
            '给定 selector 时：使用 scrollIntoView（默认 true）。为 false 时将容器 scrollTop 设为元素的 offsetTop。',
        },
        block: {
          type: 'string',
          enum: ['start', 'center', 'end', 'nearest'],
          description: 'scrollIntoView 垂直对齐方式（元素滚入视图时默认 "center"）。',
        },
        behavior: {
          type: 'string',
          enum: ['auto', 'smooth'],
          description: '滚动行为（默认 "auto" 立即滚动）。使用 "smooth" 可动画滚动。',
        },
        containerSelector: {
          type: 'string',
          description: '滚动容器的 CSS 选择器。省略时自动检测可见的可滚动容器。',
        },
        anchorSelector: {
          type: 'string',
          description: '目标滚动容器内内容的可选 CSS 选择器。可改善嵌套或虚拟化列表的自动检测。',
        },
        frameSelector: {
          type: 'string',
          description: '要在其中滚动的同源 iframe 的可选 CSS 选择器。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID（默认：当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.WAIT,
    description:
      '等待 DOM 元素、JavaScript 条件或事件满足。支持 DOM 变更和网络响应事件；超时不会抛错，而是返回 { found: false } 供调用方决定后续处理。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '要等待的元素的 CSS 选择器。',
        },
        waitFor: {
          type: 'string',
          enum: ['visible', 'present', 'hidden', 'gone', 'enabled'],
          description:
            '要检查的状态：\n- "visible"（默认）：元素存在且可见（offsetParent !== null）\n- "present"：元素存在于 DOM 中\n- "hidden"：元素存在但被隐藏\n- "gone"：元素不在 DOM 中\n- "enabled"：元素存在、可见且未禁用',
        },
        jsCondition: {
          type: 'string',
          description:
            '返回布尔值的自定义 JavaScript 表达式。在页面上下文中求值。是 selector+waitFor 的替代方案。示例：\'document.querySelectorAll(".item").length >= 10\'',
        },
        frameSelector: {
          type: 'string',
          description: '在其中求值条件的同源 iframe 的可选 CSS 选择器。',
        },
        timeout: {
          type: 'number',
          description: '最大等待时间（毫秒，默认 10000，上限 120000）。',
        },
        pollInterval: {
          type: 'number',
          description: '轮询间隔（毫秒，默认 200，最小 50）。',
        },
        stableForMs: {
          type: 'number',
          description: '要求条件连续成立这么多毫秒后才返回（默认 0）。',
        },
        event: {
          type: 'string',
          enum: ['mutation', 'network'],
          description:
            '事件驱动等待。mutation 通过观察 DOM 变化实现（无需轮询）；network 等待匹配的响应。',
        },
        observeSelector: {
          type: 'string',
          description: 'MutationObserver 的根节点；默认是 selector 或 body。',
        },
        urlPattern: { type: 'string', description: '要匹配的网络响应 URL 子串。' },
        statusCode: { type: 'number', description: '可选的确切网络响应状态码。' },
        needResponseBody: {
          type: 'boolean',
          description: '网络事件：可用时返回匹配的响应正文。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID（默认：当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.EXTRACT,
    description:
      '使用 CSS 选择器从网页提取结构化数据。支持嵌套字段提取、同源 iframe 定位、表格提取和可配置上限。\n\n示例：\n{\n  "selector": ".product-card",\n  "fields": [\n    { "name": "title", "selector": ".product-title", "type": "text" },\n    { "name": "price", "selector": ".price", "type": "number" },\n    { "name": "link", "selector": "a", "type": "href" }\n  ]\n}',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: '要提取元素的 CSS 选择器（每个匹配成为结果数组中的一个条目）。',
        },
        fields: {
          type: 'array',
          description:
            '从每个匹配元素中提取的字段。每个字段定义名称、相对 CSS 选择器以及值的提取方式。',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: '输出对象中的字段名（必填）。',
              },
              selector: {
                type: 'string',
                description: '相对父元素的 CSS 选择器。省略时使用父元素本身。',
              },
              type: {
                type: 'string',
                enum: [
                  'text',
                  'html',
                  'outerHtml',
                  'attribute',
                  'attr',
                  'number',
                  'href',
                  'src',
                  'table',
                ],
                description:
                  '值的提取方式：\n- "text"（默认）：普通元素取 element.textContent（去空白）；input/textarea/select 回退读取实时 value\n- "html"：element.innerHTML\n- "outerHtml"：element.outerHTML\n- "attribute"：element.getAttribute(attribute)；attribute="value" 时表单控件读取实时 value\n- "number"：parseFloat(textContent) 或 null\n- "href"：anchor.href（解析为绝对 URL）\n- "src"：img/video/iframe 的 src（解析为绝对 URL）\n- "table"：表格的表头和行，含 colspan/rowspan',
              },
              attribute: {
                type: 'string',
                description: 'type 为 "attribute" 时的属性名（如 "href"、"data-id"、"alt"）。',
              },
              attr: {
                type: 'string',
                description: 'attribute 的兼容别名；例如 attr="value"。',
              },
              multiple: {
                type: 'boolean',
                description:
                  '为 true 时返回所有匹配子元素的数组；为 false（默认）时只返回第一个匹配。',
              },
              defaultValue: {
                description: '选择器无匹配时的回退值（默认 null）。',
              },
            },
            required: ['name'],
          },
        },
        contextSelector: {
          type: 'string',
          description:
            '缩小提取范围的可选父容器。等价于调用 document.querySelector(contextSelector).querySelectorAll(selector)。',
        },
        frameSelector: {
          type: 'string',
          description: '要在其中提取的同源 iframe 的可选 CSS 选择器。',
        },
        limit: {
          type: 'number',
          description: '最多返回的条目数（默认不限制）。',
        },
        offset: {
          type: 'number',
          description: '跳过前 N 个匹配元素（默认 0）。',
        },
        waitForSelector: {
          type: 'boolean',
          description: '为 true 时，提取前等待选择器出现在 DOM 中（默认 true）。',
        },
        waitTimeout: {
          type: 'number',
          description: 'waitForSelector 为 true 时等待选择器出现的最长时间（毫秒，默认 5000）。',
        },
        tabId: {
          type: 'number',
          description: '目标标签页 ID（默认：当前激活标签页）。',
        },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
      },
      required: ['selector', 'fields'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CLICK_AND_WAIT,
    description: '点击 CSS 选中的元素，然后等待另一选择器达到指定状态。',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '要点击的元素的 CSS 选择器。' },
        waitSelector: { type: 'string', description: '点击后要等待的 CSS 选择器。' },
        waitFor: {
          type: 'string',
          enum: ['visible', 'present', 'hidden', 'gone', 'enabled'],
          description: 'waitSelector 的预期状态（默认 visible）。',
        },
        waitTimeout: {
          type: 'number',
          description: '最大等待时间（毫秒，默认 10000）。',
        },
        tabId: { type: 'number', description: '目标标签页 ID（默认：当前激活标签页）。' },
        windowId: {
          type: 'number',
          description: '省略 tabId 时用于选取激活标签页的目标窗口 ID。',
        },
        frameId: { type: 'number', description: '点击的目标框架 ID。' },
        frameSelector: {
          type: 'string',
          description: '要在其中等待的同源 iframe 的可选选择器。',
        },
      },
      required: ['selector', 'waitSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PASTE_TEXT,
    description:
      '向富文本编辑器合成粘贴多段文本（专治 Draft.js 系编辑器：知乎、Medium 等）。原理是给编辑器元素派发一个带 DataTransfer 的合成 ClipboardEvent("paste")，让编辑器走原生 paste 路径完整接收全部段落，且不依赖页面焦点（不读系统剪贴板）。替代 chrome_computer type（带换行会错乱）、execCommand insertText（多段只留最后一段）与剪贴板 API（无焦点被拒）。建议粘贴后刷新页面验证草稿完整，再点击发布按钮。',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要粘贴的文本，可含换行；空行会被拆成独立段落。',
        },
        selector: {
          type: 'string',
          description: '编辑器元素 CSS 选择器；缺省自动探测 [contenteditable="true"]。',
        },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
      },
      required: ['text'],
    },
  },
];

for (const tool of TOOL_SCHEMAS) {
  (tool.inputSchema as any).properties.intent = {
    type: 'string',
    description: '可选的当前操作意图，会显示在浏览器状态浮层中。',
  };
  (tool.inputSchema as any).properties.expectedUrl = {
    type: 'string',
    description: '仅当目标标签页 URL 以该值开头时才执行，否则拒绝调用。',
  };
  if (tool.name !== TOOL_NAMES.BROWSER.PROFILE) {
    (tool.inputSchema as any).properties.profileId = {
      type: 'string',
      description: '可选的隔离浏览器 Profile ID；省略时直接操作当前 Chrome。',
    };
    (tool.inputSchema as any).properties.actionPolicy = {
      type: 'string',
      enum: ['fast', 'balanced', 'human'],
      default: 'balanced',
      description: '统一动作节奏：fast、balanced（默认）或 human。',
    };
  }
}

const ZH_PARAMETER_DESCRIPTIONS: Record<string, string> = {
  action: '要执行的操作。',
  cardSelector: '要检查的卡片元素 CSS 选择器。',
  fields: '从每个匹配卡片中提取的字段。',
  identityFields: '用于唯一标识记录的字段名。',
  maxItems: '最多返回的记录数量。',
  maxDurationMs: '单次采集的最大时长，单位为毫秒。',
  returnBatches: '是否按批次返回采集结果。',
  batchSize: '每批返回的记录数量。',
  returnProgress: '是否返回滚动进度快照。',
  progressEverySteps: '每多少步记录一个进度点。',
  containerSelector: '嵌套滚动容器的 CSS 选择器。',
  anchorSelector: '用于自动定位滚动容器的内容锚点 CSS 选择器。',
  targets: '多个窗口或标签页的目标数组。',
  maxConcurrency: '同时采集的最大目标数。',
  failFast: '首个目标失败后是否停止启动新目标。',
  scroll: '加载更多列表条目时使用的滚动选项。',
  state: '要保存或恢复的调用方 JSON 安全状态。',
  response: '匹配目标 JSON 响应的规则。',
  extract: '从响应中提取记录的 JSONPath 规则。',
  reason: '请求诊断快照或轮换代理的原因。',
  domLimit: '最多包含的 DOM 字符数。',
  consoleLimit: '最多包含的控制台条目数。',
  taskId: '调用方定义的稳定任务 ID。',
  candidates: '按顺序尝试的选择器或可见文本候选项。',
  scopeSelector: '所属区域的 CSS 选择器。',
  waitSelector: '操作后要等待的 CSS 选择器。',
  waitFor: '目标元素的预期状态。',
  waitTimeout: '最长等待时间，单位为毫秒。',
  trigger: '展开区域的控件选择器或引用。',
  expandedAttribute: '表示区域已展开的属性或状态。',
  contentSelector: '区域内容的 CSS 选择器。',
  targetSelector: '要查找区域的 CSS 选择器。',
  stopSelector: '出现此选择器时停止。',
  direction: '滚动方向。',
  step: '每次滚动移动的像素数。',
  maxSteps: '最多滚动的步数。',
  rescanUpSteps: '到达目标区域后向上复扫的步数。',
  waitAfterScrollMs: '每次滚动后等待的毫秒数。',
  next: '下一页控件的选择器或引用。',
  expectedCount: '当前页面预期的记录数量。',
  pageSize: '预期的每页记录数。',
  maxPages: '最多处理的页数。',
  changeMode: '判断页面发生变化的规则。',
  excludeIfTextMatches: '排除记录时使用的不区分大小写的文本模式。',
  includeOuterHtml: '是否包含每张卡片的 outer HTML。',
  emptyTextMarkers: '表示空状态的文本标记。',
  countSelector: '用于统计内容条目的 CSS 选择器。',
  sources: '按优先级合并的记录来源。',
  textNormalize: '比较身份字段前是否规范化文本。',
  dateToleranceDays: '匹配记录时允许的日期差天数。',
  fieldPriority: '字段冲突时的来源优先级。',
  allowSourceOnlyRecords: '是否保留只出现在一个来源中的记录。',
  resourceTypes: '要阻止的资源类型。',
  urlPatterns: '要阻止的 CDP URL 通配符模式。',
  textQuery: '可选的可见文本过滤条件。',
  selector: '目标元素的 CSS 选择器。',
  includeCoordinates: '是否包含元素坐标。',
  types: '要包含的交互元素类型。',
  tabId: '目标标签页 ID；默认为当前激活标签页。',
  windowId: '用于选择激活标签页的目标窗口 ID。',
  frameSelector: '可选的同源 iframe 选择器。',
  profileId: '可选的隔离浏览器 Profile ID；省略时操作当前 Chrome。',
  actionPolicy: '统一动作节奏：fast、balanced（默认）或 human。',
};

function fillChineseDescriptions(schema: Record<string, any>, name: string) {
  if (!schema.description)
    schema.description = ZH_PARAMETER_DESCRIPTIONS[name] ?? `参数“${name}”。`;
  for (const [childName, childSchema] of Object.entries(schema.properties ?? {})) {
    fillChineseDescriptions(childSchema as Record<string, any>, childName);
  }
  if (schema.items && typeof schema.items === 'object') {
    fillChineseDescriptions(schema.items as Record<string, any>, `${name}项`);
  }
}

for (const tool of TOOL_SCHEMAS) {
  for (const [name, schema] of Object.entries((tool.inputSchema as any).properties ?? {})) {
    fillChineseDescriptions(schema as Record<string, any>, name);
  }
}
