import { type Tool } from '@modelcontextprotocol/sdk/types.js';

const TOOL_NAMES = {
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

export const TOOL_SCHEMAS_EN: Tool[] = [
  {
    name: TOOL_NAMES.BROWSER.PROFILE,
    description:
      'Manage isolated browser profiles. Without profileId, browser tools keep controlling the current Chrome; with profileId, they run in that profile.',
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
    description: 'Run a bounded sequence of browser tool calls; profileId can pin the batch to one isolated Profile.',
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
      'Collect dynamic or virtualized lists concurrently from multiple tabs or windows, returning per-target results, state, batches, progress, and failures.',
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
      'Wait for a network response after navigation or a click. Optionally click a confirmation control and return HTTP status, request body, and response body so async delete operations can be verified; provide extract only when JSON records are needed.',
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
      properties: { tabId: { type: 'number', description: 'Target tab ID.' } },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.DIAGNOSTIC_SNAPSHOT,
    description: '返回标签页的一组诊断信息：视口截图、DOM 快照、控制台缓冲和当前网络捕获摘要。',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Target tab ID.' },
        domLimit: {
          type: 'number',
          description: 'Maximum DOM characters (default 50000, cap 250000).',
        },
        consoleLimit: {
          type: 'number',
          description: 'Maximum console entries (default 100, cap 500).',
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
          description: 'status only reads state; test also checks the proxy exit IP.',
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
        tabId: { type: 'number', description: 'Target tab ID; defaults to the active tab.' },
        reason: {
          type: 'string',
          minLength: 1,
          description: 'Why the caller considers the current page abnormal.',
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
          description: 'CSS selector for the owning region, for example the reviews section.',
        },
        selector: { type: 'string', description: 'CSS selector within the scope.' },
        text: { type: 'string', description: 'Optional visible text filter for click.' },
        role: { type: 'string', description: 'Optional ARIA role filter for click.' },
        frameId: { type: 'number', description: 'Frame ID from Chrome frame inspection.' },
        tabId: { type: 'number', description: 'Target tab ID.' },
        itemSelector: { type: 'string', description: 'For paginate, item selector within scope.' },
        nextSelector: {
          type: 'string',
          description: 'For paginate, next-page control selector within scope.',
        },
        stopSelector: {
          type: 'string',
          description: 'For paginate, stop when this selector appears.',
        },
        maxPages: {
          type: 'number',
          description: 'For paginate, maximum pages (default 50, cap 200).',
        },
        timeout: {
          type: 'number',
          description: 'For paginate, per-page DOM-change timeout in milliseconds.',
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
        taskId: { type: 'string', description: 'Stable caller-defined task ID.' },
        url: { type: 'string', description: 'Initial URL when creating.' },
        state: {
          type: 'object',
          description: 'JSON-safe state, for example product ID and current review page.',
        },
      },
      required: ['action', 'taskId'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_WINDOWS_AND_TABS,
    description: 'Get all currently open browser windows and tabs',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CREATE_TAB,
    description:
      'Create a browser tab with an optional URL, window, foreground/background state, and pin state.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to open in the new tab; omit to open a new-tab page.',
        },
        windowId: { type: 'number', description: 'Create the tab in this window.' },
        active: {
          type: 'boolean',
          description: 'Whether to activate the new tab; takes precedence over background.',
        },
        background: {
          type: 'boolean',
          description: 'Open in the background; true is equivalent to active=false.',
        },
        pinned: { type: 'boolean', description: 'Pin the new tab.' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HOVER,
    description: 'Move the mouse over an element selected by CSS or XPath.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS or XPath selector for the target element.' },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'Selector type; defaults to css.',
        },
        tabId: { type: 'number', description: 'Target tab ID; defaults to the active tab.' },
        windowId: { type: 'number', description: 'Window to use when tabId is omitted.' },
        durationMs: {
          type: 'number',
          description: 'How long to keep the hover active in milliseconds (default 250).',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PRINT_TO_PDF,
    description:
      'Print a page to PDF with CDP Page.printToPDF, supporting CSS page size and custom paper sizes.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Target tab ID; defaults to the active tab.' },
        windowId: { type: 'number', description: 'Window to use when tabId is omitted.' },
        pageSize: {
          type: 'string',
          enum: ['page', 'A3', 'A4', 'A5', 'Letter', 'Legal', 'Tabloid', 'custom'],
          description: 'Paper size; page uses CSS size and custom uses paperWidth/paperHeight.',
        },
        paperSize: { type: 'string', description: 'Compatibility alias for pageSize.' },
        paperWidth: {
          type: 'number',
          description: 'Custom paper width in inches; provide with paperHeight.',
        },
        paperHeight: {
          type: 'number',
          description: 'Custom paper height in inches; provide with paperWidth.',
        },
        landscape: { type: 'boolean', description: 'Print in landscape orientation.' },
        printBackground: {
          type: 'boolean',
          description: 'Print background graphics; defaults to true.',
        },
        preferCSSPageSize: { type: 'boolean', description: 'Prefer the page CSS @page size.' },
        scale: { type: 'number', description: 'Print scale.' },
        marginTop: { type: 'number', description: 'Top margin in inches.' },
        marginBottom: { type: 'number', description: 'Bottom margin in inches.' },
        marginLeft: { type: 'number', description: 'Left margin in inches.' },
        marginRight: { type: 'number', description: 'Right margin in inches.' },
        pageRanges: { type: 'string', description: 'Page ranges to print, for example 1-3.' },
        displayHeaderFooter: { type: 'boolean', description: 'Display the header and footer.' },
        headerTemplate: { type: 'string', description: 'Header HTML template.' },
        footerTemplate: { type: 'string', description: 'Footer HTML template.' },
        savePdf: { type: 'boolean', description: 'Also save the PDF to Chrome downloads.' },
        filename: { type: 'string', description: 'Filename used when saving the PDF.' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_ELEMENT_INFO,
    description: 'Get an element attributes, computed styles, and bounding rectangle.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS or XPath selector for the target element.' },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'Selector type; defaults to css.',
        },
        tabId: { type: 'number', description: 'Target tab ID; defaults to the active tab.' },
        windowId: { type: 'number', description: 'Window to use when tabId is omitted.' },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.STORAGE_GET,
    description: 'Read a page localStorage or sessionStorage area.',
    inputSchema: {
      type: 'object',
      properties: {
        storageArea: {
          type: 'string',
          enum: ['local', 'session'],
          description: 'Storage area; defaults to local.',
        },
        key: { type: 'string', description: 'Key to read; omit to read all keys.' },
        keys: { type: 'array', items: { type: 'string' }, description: 'Multiple keys to read.' },
        tabId: { type: 'number', description: 'Target tab ID; defaults to the active tab.' },
        windowId: { type: 'number', description: 'Window to use when tabId is omitted.' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.STORAGE_SET,
    description: 'Write page localStorage or sessionStorage; values are serialized as JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        storageArea: {
          type: 'string',
          enum: ['local', 'session'],
          description: 'Storage area; defaults to local.',
        },
        key: { type: 'string', description: 'Key to write.' },
        value: {
          description:
            'Value to write; strings are stored as-is and other values are JSON-serialized.',
        },
        items: {
          type: 'object',
          description: 'Object of key/value pairs for batch writes; use instead of key/value.',
        },
        tabId: { type: 'number', description: 'Target tab ID; defaults to the active tab.' },
        windowId: { type: 'number', description: 'Window to use when tabId is omitted.' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.STORAGE_DELETE,
    description: 'Delete keys from page localStorage or sessionStorage.',
    inputSchema: {
      type: 'object',
      properties: {
        storageArea: {
          type: 'string',
          enum: ['local', 'session'],
          description: 'Storage area; defaults to local.',
        },
        key: { type: 'string', description: 'Key to delete.' },
        keys: { type: 'array', items: { type: 'string' }, description: 'Multiple keys to delete.' },
        tabId: { type: 'number', description: 'Target tab ID; defaults to the active tab.' },
        windowId: { type: 'number', description: 'Window to use when tabId is omitted.' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COOKIE_GET,
    description: 'Get cookies, optionally filtered by URL, domain, name, or cookie store.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Only return cookies that apply to this URL.' },
        domain: { type: 'string', description: 'Only return cookies for this domain.' },
        name: { type: 'string', description: 'Only return cookies with this name.' },
        storeId: {
          type: 'string',
          description: 'Only return cookies from this browser profile store.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COOKIE_SET,
    description:
      'Set a browser cookie, including HttpOnly, Secure, SameSite, path, and expiration settings.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'A URL on the cookie domain; required by Chrome to set the cookie.',
        },
        name: { type: 'string', description: 'Cookie name.' },
        value: { type: 'string', description: 'Cookie value.' },
        domain: {
          type: 'string',
          description: 'Optional cookie domain; it must match the URL host.',
        },
        path: { type: 'string', description: 'Cookie path (default: /).' },
        secure: { type: 'boolean', description: 'Send only over HTTPS.' },
        httpOnly: { type: 'boolean', description: 'Hide from page JavaScript.' },
        sameSite: {
          type: 'string',
          enum: ['no_restriction', 'lax', 'strict', 'unspecified'],
          description: 'SameSite policy.',
        },
        expirationDate: {
          type: 'number',
          description: 'Unix timestamp in seconds; omit for a session cookie.',
        },
        storeId: { type: 'string', description: 'Browser profile store ID.' },
      },
      required: ['url', 'name', 'value'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COOKIE_DELETE,
    description: 'Delete a cookie identified by its URL and name.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'A URL matching the cookie to delete.' },
        name: { type: 'string', description: 'Cookie name.' },
        storeId: { type: 'string', description: 'Browser profile store ID.' },
      },
      required: ['url', 'name'],
    },
  },
  {
    name: 'search_tabs_content',
    description:
      'Search the readable content of explicitly selected browser tabs using semantic similarity. Selected tabs are indexed on demand.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The text or topic to search for.' },
        tabIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'One to five tab IDs to search.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of matching tabs to return (default: 10, max: 20).',
        },
      },
      required: ['query', 'tabIds'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_START_TRACE,
    description:
      'Starts a performance trace recording on the selected page. Optionally reloads the page and/or auto-stops after a short duration.',
    inputSchema: {
      type: 'object',
      properties: {
        reload: {
          type: 'boolean',
          description:
            'Determines if, once tracing has started, the page should be automatically reloaded (ignore cache).',
        },
        autoStop: {
          type: 'boolean',
          description: 'Determines if the trace should be automatically stopped (default false).',
        },
        durationMs: {
          type: 'number',
          description: 'Auto-stop duration in milliseconds when autoStop is true (default 5000).',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_STOP_TRACE,
    description: 'Stops the active performance trace recording on the selected page.',
    inputSchema: {
      type: 'object',
      properties: {
        saveToDownloads: {
          type: 'boolean',
          description: 'Whether to save the trace as a JSON file in Downloads (default true).',
        },
        filenamePrefix: {
          type: 'string',
          description: 'Optional filename prefix for the downloaded trace JSON.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_ANALYZE_INSIGHT,
    description:
      'Provides a lightweight summary of the last recorded trace. For deep insights (CWV, breakdowns), integrate native-side DevTools trace engine.',
    inputSchema: {
      type: 'object',
      properties: {
        insightName: {
          type: 'string',
          description:
            'Optional insight name for future deep analysis (e.g., "DocumentLatency"). Currently informational only.',
        },
        timeoutMs: {
          type: 'number',
          description:
            'Timeout for deep analysis via native host (milliseconds). Default 60000. Increase for large traces.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.READ_PAGE,
    description:
      'Get an accessibility tree representation of visible elements on the page. Only returns elements that are visible in the viewport. Optionally filter for only interactive elements.\nTip: If the returned elements do not include the specific element you need, use the computer tool\'s screenshot (action="screenshot") to capture the element\'s on-screen coordinates, then operate by coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'Optional URL. When provided, navigate the target tab before reading it; when omitted, read the current target tab.',
        },
        maxOutputBytes: {
          type: 'number',
          description:
            'Maximum JSON response size. Defaults to 24000 bytes and is capped at 200000; oversized output is truncated with metadata.',
        },
        filter: {
          type: 'string',
          description:
            'Filter elements: "interactive" for such as  buttons/links/inputs only (default: all visible elements)',
        },
        depth: {
          type: 'number',
          description:
            'Maximum DOM depth to traverse (integer >= 0). Lower values reduce output size and can improve performance.',
        },
        refId: {
          type: 'string',
          description:
            'Focus on the subtree rooted at this element refId (e.g., "ref_12"). The refId must come from a recent chrome_read_page response in the same tab (refs may expire).',
        },
        tabId: {
          type: 'number',
          description: 'Target an existing tab by ID (default: active tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab when tabId is omitted.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.COMPUTER,
    description:
      "Use a mouse and keyboard to interact with a web browser, and take screenshots.\n* Whenever you intend to click on an element like an icon, you should consult a read_page to determine the ref of the element before moving the cursor.\n* If you tried clicking on a program or link but it failed to load, even after waiting, try screenshot and then adjusting your click location so that the tip of the cursor visually falls on the element that you want to click.\n* Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked.",
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Target tab ID (default: active tab)' },
        windowId: {
          type: 'number',
          description: 'Window ID used to choose the active tab when tabId is omitted.',
        },
        background: {
          type: 'boolean',
          description:
            'Avoid focusing/activating tab/window for certain operations (best-effort). Default: true; set false only when foreground interaction is required.',
        },
        action: {
          type: 'string',
          description:
            'Action to perform: left_click | right_click | double_click | triple_click | left_click_drag | scroll | scroll_to | type | key | fill | fill_form | hover | wait | resize_page | zoom | screenshot',
        },
        ref: {
          type: 'string',
          description:
            'Element ref from chrome_read_page. For click/scroll/scroll_to/key/type and drag end when provided; takes precedence over coordinates.',
        },
        coordinates: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
          },
          description:
            'Coordinates for actions (in screenshot space if a recent screenshot was taken, otherwise viewport). Required for click/scroll and as end point for drag.',
        },
        startCoordinates: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          description: 'Starting coordinates for drag action',
        },
        startRef: {
          type: 'string',
          description: 'Drag start ref from chrome_read_page (alternative to startCoordinates).',
        },
        scrollDirection: {
          type: 'string',
          description: 'Scroll direction: up | down | left | right',
        },
        scrollAmount: {
          type: 'number',
          description: 'Scroll ticks (1-10), default 3',
        },
        text: {
          type: 'string',
          description:
            'Text to type (for action=type) or keys/chords separated by space (for action=key, e.g. "Backspace Enter" or "cmd+a")',
        },
        repeat: {
          type: 'number',
          description:
            'For action=key: number of times to repeat the key sequence (integer 1-100, default 1).',
        },
        modifiers: {
          type: 'object',
          description:
            'Modifier keys for click actions (left_click/right_click/double_click/triple_click).',
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
            'For action=zoom: rectangular region to capture (x0,y0)-(x1,y1) in viewport pixels (or screenshot-space if a recent screenshot context exists).',
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
            'CSS selector for fill or scroll_to (alternative to ref); scroll_to can also locate by text.',
        },
        value: {
          oneOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'number' }],
          description: 'Value to set for action=fill (string | boolean | number)',
        },
        elements: {
          type: 'array',
          description: 'For action=fill_form: list of elements to fill (ref + value)',
          items: {
            type: 'object',
            properties: {
              ref: { type: 'string', description: 'Element ref from chrome_read_page' },
              value: { type: 'string', description: 'Value to set (stringified if non-string)' },
            },
            required: ['ref', 'value'],
          },
        },
        width: { type: 'number', description: 'For action=resize_page: viewport width' },
        height: { type: 'number', description: 'For action=resize_page: viewport height' },
        appear: {
          type: 'boolean',
          description:
            'For action=wait with text: whether to wait for the text to appear (true, default) or disappear (false)',
        },
        timeout: {
          type: 'number',
          description:
            'For action=wait with text: timeout in milliseconds (default 10000, max 120000)',
        },
        duration: {
          type: 'number',
          description: 'Seconds to wait for action=wait (max 30s)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.POST_TO_X,
    description:
      'Publish one text post on an already signed-in X/Twitter page. The tool waits for the editor, fills and read-back verifies the text, waits for an enabled submit button, clicks once, and waits for a new confirmation marker. It returns published, failed, or unknown; unknown never retries automatically to avoid duplicate posts. Custom selectors support compatible X page variants.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Post body. The tool never retries automatically.' },
        editorSelector: {
          type: 'string',
          description:
            'Optional editor CSS selector; defaults cover X tweetTextarea and contenteditable editors.',
        },
        submitSelector: {
          type: 'string',
          description:
            'Optional submit-button CSS selector; defaults cover X tweetButtonInline and tweetButton.',
        },
        successSelector: {
          type: 'string',
          description:
            'Optional success-marker CSS selector; defaults observe X toast or role=status elements.',
        },
        successText: {
          type: 'string',
          description:
            'Optional success-marker text; a new marker must contain this text when provided.',
        },
        timeout: {
          type: 'number',
          description: 'Maximum wait per stage in milliseconds (default 20000, maximum 120000).',
        },
        tabId: { type: 'number', description: 'Target X tab ID; defaults to the active tab.' },
        windowId: {
          type: 'number',
          description: 'Window ID used to select the active tab when tabId is omitted.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.USERSCRIPT,
    description:
      'Manage browser userscripts: create, inspect, enable, disable, update, remove, export, or send commands to installed scripts. This is high-risk and requires explicit approval when the approval policy is enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'list', 'get', 'enable', 'disable', 'update', 'remove', 'send_command', 'export'],
          description: 'Userscript operation to perform.',
        },
        args: {
          type: 'object',
          description:
            'Operation arguments. create/update use script, name, matches, world, and related fields; get/enable/disable/remove/send_command use id.',
          properties: {
            id: { type: 'string', description: 'Userscript ID.' },
            script: { type: 'string', description: 'JS, CSS, or Tampermonkey script source.' },
            name: { type: 'string', description: 'Userscript name.' },
            description: { type: 'string', description: 'Userscript description.' },
            matches: {
              type: 'array',
              items: { type: 'string' },
              description: 'Page match patterns where the script should apply.',
            },
            excludes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Page match patterns where the script should not apply.',
            },
            persist: { type: 'boolean', description: 'Persist the script; defaults to true.' },
            runAt: {
              type: 'string',
              enum: ['document_start', 'document_end', 'document_idle', 'auto'],
              description: 'Script injection timing.',
            },
            world: {
              type: 'string',
              enum: ['auto', 'ISOLATED', 'MAIN'],
              description: 'Script execution world.',
            },
            allFrames: { type: 'boolean', description: 'Inject into all frames; defaults to true.' },
            mode: {
              type: 'string',
              enum: ['auto', 'css', 'persistent', 'once'],
              description: 'Injection strategy; once evaluates once without persistence.',
            },
            dnrFallback: { type: 'boolean', description: 'Use DNR fallback when needed; defaults to true.' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Userscript tags.',
            },
            query: { type: 'string', description: 'Name/description filter for list.' },
            status: {
              type: 'string',
              enum: ['enabled', 'disabled'],
              description: 'Enabled-state filter for list.',
            },
            domain: { type: 'string', description: 'Domain filter for list.' },
            payload: { description: 'Arbitrary JSON payload for send_command.' },
            tabId: { type: 'number', description: 'Target tab ID for send_command.' },
          },
          additionalProperties: true,
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.NAVIGATE,
    description:
      'Navigate to a URL, refresh the current tab, or navigate browser history (back/forward)',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'URL to navigate to. Special values: "back" or "forward" to navigate browser history in the target tab.',
        },
        newWindow: {
          type: 'boolean',
          description: 'Create a new window to navigate to the URL or not. Defaults to false',
        },
        tabId: {
          type: 'number',
          description:
            'Target an existing tab by ID (if provided, navigate/refresh/back/forward that tab instead of the active tab).',
        },
        windowId: {
          type: 'number',
          description:
            'Target an existing window by ID (when creating a new tab in existing window, or picking active tab if tabId is not provided).',
        },
        background: {
          type: 'boolean',
          description:
            'Perform the operation without stealing focus. Default: true; set false only when foreground interaction is required.',
        },
        activateTab: {
          type: 'boolean',
          description:
            'Keep the target tab active within its own window while background=true, without focusing that window. Use for pages that must continue rendering virtualized content.',
        },
        width: {
          type: 'number',
          description:
            'Window width in pixels (default: 1280). When width or height is provided, a new window will be created.',
        },
        height: {
          type: 'number',
          description:
            'Window height in pixels (default: 720). When width or height is provided, a new window will be created.',
        },
        refresh: {
          type: 'boolean',
          description:
            'Refresh the current active tab instead of navigating to a URL. When true, the url parameter is ignored. Defaults to false',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SCREENSHOT,
    description:
      '[Prefer read_page over taking a screenshot and Prefer chrome_computer] Take a screenshot of the current page or a specific element. For new usage, use chrome_computer with action="screenshot". Use this tool if you need advanced options.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the screenshot, if saving as PNG' },
        selector: { type: 'string', description: 'CSS selector for element to screenshot' },
        tabId: {
          type: 'number',
          description: 'Target tab ID to capture from (default: active tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from when tabId is not provided.',
        },
        background: {
          type: 'boolean',
          description:
            'Attempt capture without bringing tab/window to foreground. CDP-based capture is used for simple viewport captures. For element/full-page capture, the tab may still be made active in its window without focusing the window. Default: false',
        },
        width: { type: 'number', description: 'Width in pixels (default: 800)' },
        height: { type: 'number', description: 'Height in pixels (default: 600)' },
        storeBase64: {
          type: 'boolean',
          description:
            'return screenshot in base64 format (default: false) if you want to see the page, recommend set this to be true',
        },
        fullPage: {
          type: 'boolean',
          description: 'Store screenshot of the entire page (default: true)',
        },
        savePng: {
          type: 'boolean',
          description:
            'Save screenshot as PNG file (default: true)，if you want to see the page, recommend set this to be false, and set storeBase64 to be true',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CLOSE_TABS,
    description: 'Close one or more browser tabs',
    inputSchema: {
      type: 'object',
      properties: {
        tabIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of tab IDs to close. If not provided, will close the active tab.',
        },
        url: {
          type: 'string',
          description: 'Close tabs matching this URL. Can be used instead of tabIds.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SWITCH_TAB,
    description: 'Switch to a specific browser tab',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to switch to.',
        },
        windowId: {
          type: 'number',
          description: 'The ID of the window where the tab is located.',
        },
      },
      required: ['tabId'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.WEB_FETCHER,
    description: 'Fetch content from a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch content from. If not provided, uses the current active tab',
        },
        tabId: {
          type: 'number',
          description: 'Target an existing tab by ID (default: active tab).',
        },
        background: {
          type: 'boolean',
          description: 'Do not activate tab/focus window while fetching (default: true)',
        },
        htmlContent: {
          type: 'boolean',
          description:
            'Get the visible HTML content of the page. If true, textContent will be ignored (default: false)',
        },
        textContent: {
          type: 'boolean',
          description:
            'Get the visible text content of the page with metadata. Ignored if htmlContent is true (default: true)',
        },

        selector: {
          type: 'string',
          description:
            'CSS selector to get content from a specific element. If provided, only content from this element will be returned',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.NETWORK_REQUEST,
    description: 'Send a network request from the browser with cookies and other browser context',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to send the request to',
        },
        method: {
          type: 'string',
          description: 'HTTP method to use (default: GET)',
        },
        headers: {
          type: 'object',
          description: 'Headers to include in the request',
        },
        body: {
          type: 'string',
          description: 'Body of the request (for POST, PUT, etc.)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
        formData: {
          type: 'object',
          description:
            'Multipart/form-data descriptor. If provided, overrides body and builds FormData with optional file attachments. Shape: { fields?: Record<string,string|number|boolean>, files?: Array<{ name: string, fileUrl?: string, filePath?: string, base64Data?: string, filename?: string, contentType?: string }> }. Also supports a compact array form: [ [name, fileSpec, filename?], ... ] where fileSpec may be url:, file:, or base64:.',
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
          description: 'Action to perform: "start" begins capture, "stop" ends and returns results',
        },
        needResponseBody: {
          type: 'boolean',
          description:
            'When true, captures response body using Debugger API (default: false). Only use when you need to inspect response content.',
        },
        url: {
          type: 'string',
          description:
            'URL to capture network requests from. For action="start". If not provided, uses the current active tab.',
        },
        maxCaptureTime: {
          type: 'number',
          description: 'Maximum capture time in milliseconds (default: 180000)',
        },
        inactivityTimeout: {
          type: 'number',
          description: 'Stop after inactivity in milliseconds (default: 60000). Set 0 to disable.',
        },
        includeStatic: {
          type: 'boolean',
          description: 'Include static resources like images/scripts/styles (default: false)',
        },
        tabId: {
          type: 'number',
          description:
            'Capture only this tab. When stopping, only this tab is stopped; no other capture is affected.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BLOCK_IMAGES,
    description:
      'Block image network requests in a tab using Chrome DevTools Protocol. Start this before navigating or reloading to prevent future image downloads; stop restores normal image loading.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop'],
          description: '"start" blocks future image requests; "stop" restores image loading',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID. Defaults to the active tab.',
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
        tabId: { type: 'number', description: 'Target tab ID; defaults to active tab.' },
        resourceTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['Image', 'Font', 'Media', 'Script', 'Stylesheet', 'XHR', 'Fetch'],
          },
          description: 'Resource types to block; defaults to Image.',
        },
        urlPatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'CDP URL wildcard patterns to block, for example *://*.doubleclick.net/*.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HANDLE_DOWNLOAD,
    description: 'Wait for a browser download and return details (id, filename, url, state, size)',
    inputSchema: {
      type: 'object',
      properties: {
        filenameContains: { type: 'string', description: 'Filter by substring in filename or URL' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default 60000, max 300000)' },
        waitForComplete: { type: 'boolean', description: 'Wait until completed (default true)' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HISTORY,
    description: 'Retrieve and search browsing history from Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description:
            'Text to search for in history URLs and titles. Leave empty to retrieve all history entries within the time range.',
        },
        startTime: {
          type: 'string',
          description:
            'Start time as a date string. Supports ISO format (e.g., "2023-10-01", "2023-10-01T14:30:00"), relative times (e.g., "1 day ago", "2 weeks ago", "3 months ago", "1 year ago"), and special keywords ("now", "today", "yesterday"). Default: 24 hours ago',
        },
        endTime: {
          type: 'string',
          description:
            'End time as a date string. Supports ISO format (e.g., "2023-10-31", "2023-10-31T14:30:00"), relative times (e.g., "1 day ago", "2 weeks ago", "3 months ago", "1 year ago"), and special keywords ("now", "today", "yesterday"). Default: current time',
        },
        maxResults: {
          type: 'number',
          description:
            'Maximum number of history entries to return. Use this to limit results for performance or to focus on the most relevant entries. (default: 100)',
        },
        excludeCurrentTabs: {
          type: 'boolean',
          description:
            "When set to true, filters out URLs that are currently open in any browser tab. Useful for finding pages you've visited but don't have open anymore. (default: false)",
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_SEARCH,
    description: 'Search Chrome bookmarks by title and URL',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query to match against bookmark titles and URLs. Leave empty to retrieve all bookmarks.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of bookmarks to return (default: 50)',
        },
        folderPath: {
          type: 'string',
          description:
            'Optional folder path or ID to limit search to a specific bookmark folder. Can be a path string (e.g., "Work/Projects") or a folder ID.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_ADD,
    description: 'Add a new bookmark to Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to bookmark. If not provided, uses the current active tab URL.',
        },
        title: {
          type: 'string',
          description: 'Title for the bookmark. If not provided, uses the page title from the URL.',
        },
        parentId: {
          type: 'string',
          description:
            'Parent folder path or ID to add the bookmark to. Can be a path string (e.g., "Work/Projects") or a folder ID. If not provided, adds to the "Bookmarks Bar" folder.',
        },
        createFolder: {
          type: 'boolean',
          description: 'Whether to create the parent folder if it does not exist (default: false)',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_DELETE,
    description: 'Delete a bookmark from Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        bookmarkId: {
          type: 'string',
          description: 'ID of the bookmark to delete. Either bookmarkId or url must be provided.',
        },
        url: {
          type: 'string',
          description: 'URL of the bookmark to delete. Used if bookmarkId is not provided.',
        },
        title: {
          type: 'string',
          description: 'Title of the bookmark to help with matching when deleting by URL.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.JAVASCRIPT,
    description:
      'Execute JavaScript code in a browser tab and return the result. Uses CDP Runtime.evaluate with awaitPromise and returnByValue; automatically falls back to chrome.scripting.executeScript if the debugger is busy. Output is sanitized (sensitive data redacted) and truncated by default.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'JavaScript code to execute (the parameter is code, not script). Runs inside an async function body with top-level await. An explicit return or a trailing expression/IIFE returns its value. When tabId is omitted, the most recently operated tab is preferred, falling back to the active tab only when no target history exists.',
        },
        tabId: {
          type: 'number',
          description:
            'Target tab ID. If omitted, uses the most recently operated tab, then the active tab.',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID used to choose the active tab when tabId is omitted.',
        },
        timeoutMs: {
          type: 'number',
          description: 'Execution timeout in milliseconds (default: 15000).',
        },
        maxOutputBytes: {
          type: 'number',
          description:
            'Maximum output size in bytes after sanitization (default: 51200). Output exceeding this limit will be truncated.',
        },
        requireResult: {
          type: 'boolean',
          description:
            'Require the script to return a value. When true, a script that completes with undefined returns a no_result error; default false keeps action-only scripts successful.',
        },
      },
      required: ['code'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.LOCATE_ELEMENT,
    description:
      'Locate a page element and return a fresh ref, selector, coordinates, and element metadata. Supports persisted markerId/markerName, refs, CSS/XPath, text, ARIA role, aria-label, data-testid, and name. It can scroll to and briefly highlight the target; the returned ref can be passed to click or fill.',
    inputSchema: {
      type: 'object',
      properties: {
        markerId: { type: 'string', description: 'Persisted element marker ID.' },
        markerName: { type: 'string', description: 'Persisted element marker name.' },
        ref: {
          type: 'string',
          description: 'Element ref from chrome_read_page or a previous locate call.',
        },
        selector: { type: 'string', description: 'CSS selector or XPath.' },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'Selector type; defaults to css.',
        },
        text: {
          type: 'string',
          description: 'Visible or accessible element text; fuzzy matching is supported.',
        },
        role: {
          type: 'string',
          description: 'ARIA or inferred role, such as button, textbox, or link.',
        },
        ariaLabel: { type: 'string', description: 'aria-label value to match.' },
        testId: {
          type: 'string',
          description: 'data-testid, data-test, data-qa, or data-cy value.',
        },
        name: { type: 'string', description: 'Form element name attribute.' },
        allowMultiple: {
          type: 'boolean',
          description: 'Allow multiple matches and return the first one.',
        },
        scrollIntoView: {
          type: 'boolean',
          description: 'Scroll the target to the center of the viewport; defaults to true.',
        },
        highlight: {
          type: 'boolean',
          description: 'Briefly highlight the target; defaults to true.',
        },
        timeout: {
          type: 'number',
          description: 'Maximum wait time in milliseconds; defaults to 5000.',
        },
        tabId: { type: 'number', description: 'Target tab ID.' },
        windowId: {
          type: 'number',
          description: 'Window used to choose the active tab when tabId is omitted.',
        },
        frameId: { type: 'number', description: 'Target iframe frame ID.' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SELECT_ALL_ITEMS,
    description:
      'Safely select all items in a lazy or virtualized list by scrolling to the bottom, waiting for a stable list, and toggling each card checkbox. Does not rely on a broken page-level select-all control or treat optimistic DOM changes as server success.',
    inputSchema: {
      type: 'object',
      properties: {
        cardSelector: { type: 'string', description: 'CSS selector for each list card.' },
        checkboxSelector: {
          type: 'string',
          description:
            'CSS selector for the checkbox inside each card, for example input[type="checkbox"].',
        },
        containerSelector: { type: 'string', description: 'Optional scroll container selector.' },
        step: { type: 'number', description: 'Scroll step in pixels. Defaults to 500.' },
        settleMs: {
          type: 'number',
          description: 'Wait after each scroll in milliseconds. Defaults to 500.',
        },
        stableRounds: {
          type: 'number',
          description: 'Consecutive stable bottom rounds. Defaults to 3.',
        },
        maxRounds: { type: 'number', description: 'Maximum scroll rounds. Defaults to 200.' },
        maxDurationMs: {
          type: 'number',
          description: 'Maximum runtime in milliseconds. Defaults to 120000.',
        },
        restoreScroll: {
          type: 'boolean',
          description: 'Restore the original scroll position after selection.',
        },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
      },
      required: ['cardSelector', 'checkboxSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CLICK,
    description:
      'Click on an element in a web page. Supports persisted markerId/markerName, CSS selector, XPath, element ref, or viewport coordinates. markerId is re-resolved before clicking.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath for the element to click.',
        },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'Type of selector (default: "css").',
        },
        markerId: { type: 'string', description: 'Persisted element marker ID.' },
        markerName: { type: 'string', description: 'Persisted element marker name.' },
        ref: {
          type: 'string',
          description: 'Element ref from chrome_read_page (takes precedence over selector).',
        },
        coordinates: {
          type: 'object',
          description: 'Viewport coordinates to click at.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
        double: {
          type: 'boolean',
          description: 'Perform double click when true (default: false).',
        },
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: 'Mouse button to click (default: "left").',
        },
        modifiers: {
          type: 'object',
          description: 'Modifier keys to hold during click.',
          properties: {
            altKey: { type: 'boolean' },
            ctrlKey: { type: 'boolean' },
            metaKey: { type: 'boolean' },
            shiftKey: { type: 'boolean' },
          },
        },
        waitForNavigation: {
          type: 'boolean',
          description: 'Wait for navigation to complete after click (default: false).',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds for waiting (default: 5000).',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID. If omitted, uses the current active tab.',
        },
        windowId: {
          type: 'number',
          description: 'Window ID to select active tab from (when tabId is omitted).',
        },
        frameId: {
          type: 'number',
          description: 'Target frame ID for iframe support.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.FILL,
    description:
      'Fill or select a form element on a web page. Supports persisted markerId/markerName, CSS selector, XPath, or element ref; markers are re-resolved before filling.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector or XPath for the form element.',
        },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'Type of selector (default: "css").',
        },
        markerId: { type: 'string', description: 'Persisted element marker ID.' },
        markerName: { type: 'string', description: 'Persisted element marker name.' },
        ref: {
          type: 'string',
          description: 'Element ref from chrome_read_page (takes precedence over selector).',
        },
        value: {
          type: ['string', 'number', 'boolean'],
          description:
            'Value to fill. For text inputs: string. For checkboxes/radios: boolean. For selects: option value or text.',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID. If omitted, uses the current active tab.',
        },
        windowId: {
          type: 'number',
          description: 'Window ID to select active tab from (when tabId is omitted).',
        },
        frameId: {
          type: 'number',
          description: 'Target frame ID for iframe support.',
        },
      },
      required: ['value'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.REQUEST_ELEMENT_SELECTION,
    description:
      'Request the user to manually select one or more elements on the current page. Use this as a human-in-the-loop fallback when you cannot reliably locate the target element after approximately 3 attempts using chrome_read_page combined with chrome_click_element/chrome_fill_or_select/chrome_computer. The user will see a panel with instructions and can click on the requested elements. Returns element refs compatible with chrome_click_element/chrome_fill_or_select (including iframe frameId for cross-frame support).',
    inputSchema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          description:
            'A list of element selection requests. Each request produces exactly one picked element. The user will see these requests in a panel and select each element by clicking on the page.',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description:
                  'Optional stable request id for correlation. If omitted, an id is auto-generated (e.g., "req_1").',
              },
              name: {
                type: 'string',
                description:
                  'Short label shown to the user describing what element to select (e.g., "Login button", "Email input field").',
              },
              description: {
                type: 'string',
                description:
                  'Optional longer instruction shown to the user with more context (e.g., "Click on the primary login button in the top-right corner").',
              },
            },
            required: ['name'],
          },
        },
        timeoutMs: {
          type: 'number',
          description:
            'Timeout in milliseconds for the user to complete all selections. Default: 180000 (3 minutes). Maximum: 600000 (10 minutes).',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID. If omitted, uses the current active tab.',
        },
        windowId: {
          type: 'number',
          description: 'Window ID to select active tab from (when tabId is omitted).',
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
          description: 'Window ID used to choose the active tab when tabId is omitted.',
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
      'Simulate keyboard input on a web page. Supports single keys (Enter, Tab, Escape), key combinations (Ctrl+C, Ctrl+V), and text input. Can target a specific element or send to the focused element.',
    inputSchema: {
      type: 'object',
      properties: {
        keys: {
          type: 'string',
          description:
            'Keys or key combinations to simulate. Examples: "Enter", "Tab", "Ctrl+C", "Shift+Tab", "Hello World".',
        },
        selector: {
          type: 'string',
          description: 'CSS selector or XPath for target element to receive keyboard events.',
        },
        selectorType: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'Type of selector (default: "css").',
        },
        delay: {
          type: 'number',
          description: 'Delay between keystrokes in milliseconds (default: 50).',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID. If omitted, uses the current active tab.',
        },
        windowId: {
          type: 'number',
          description: 'Window ID to select active tab from (when tabId is omitted).',
        },
        frameId: {
          type: 'number',
          description: 'Target frame ID for iframe support.',
        },
      },
      required: ['keys'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CONSOLE,
    description:
      'Capture console output from a browser tab. Supports snapshot mode (default; one-time capture with ~2s wait) and buffer mode (persistent per-tab buffer you can read/clear instantly without waiting).',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'URL to navigate to and capture console from. If not provided, uses the current active tab',
        },
        tabId: {
          type: 'number',
          description: 'Target an existing tab by ID (default: active tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab when tabId is omitted.',
        },
        background: {
          type: 'boolean',
          description: 'Do not activate tab/focus window when capturing via CDP. Default: true',
        },
        includeExceptions: {
          type: 'boolean',
          description: 'Include uncaught exceptions in the output (default: true)',
        },
        maxMessages: {
          type: 'number',
          description:
            'Maximum number of console messages to capture in snapshot mode (default: 100). If limit is provided, it takes precedence.',
        },
        mode: {
          type: 'string',
          enum: ['snapshot', 'buffer'],
          description:
            'Console capture mode: snapshot (default; waits ~2s for messages) or buffer (persistent per-tab buffer; reads from memory instantly).',
        },
        buffer: {
          type: 'boolean',
          description: 'Alias for mode="buffer" (default: false).',
        },
        clear: {
          type: 'boolean',
          description:
            'Buffer mode only: clear the buffered logs for this tab before reading (default: false). Use clearAfterRead instead to clear after reading (mcp-tools.js style).',
        },
        clearAfterRead: {
          type: 'boolean',
          description:
            'Buffer mode only: clear the buffered logs for this tab AFTER reading, to avoid duplicate messages on subsequent calls (default: false). This matches mcp-tools.js behavior.',
        },
        pattern: {
          type: 'string',
          description:
            'Optional regex filter applied to message/exception text. Supports /pattern/flags syntax.',
        },
        onlyErrors: {
          type: 'boolean',
          description:
            'Only return error-level console messages (and exceptions when includeExceptions=true). Default: false.',
        },
        limit: {
          type: 'number',
          description:
            'Limit returned console messages. In snapshot mode this is an alias for maxMessages; in buffer mode it limits returned messages from the buffer.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.FILE_UPLOAD,
    description:
      'Upload files to web forms with file input elements using Chrome DevTools Protocol',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Target tab ID (default: active tab)' },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab when tabId is omitted',
        },
        selector: {
          type: 'string',
          description: 'CSS selector for the file input element (input[type="file"])',
        },
        filePath: {
          type: 'string',
          description: 'Local file path to upload',
        },
        fileUrl: {
          type: 'string',
          description: 'URL to download file from before uploading',
        },
        base64Data: {
          type: 'string',
          description: 'Base64 encoded file data to upload',
        },
        fileName: {
          type: 'string',
          description: 'Optional filename when using base64 or URL (default: "uploaded-file")',
        },
        multiple: {
          type: 'boolean',
          description: 'Whether the input accepts multiple files (default: false)',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PASTE_IMAGE,
    description:
      'Paste a local image or image data into a textarea, input, or contenteditable element using a synthesized paste event. It does not read the system clipboard; it uses a temporary file input, DataTransfer, and ClipboardEvent.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Target tab ID (default: most recently operated tab)',
        },
        windowId: {
          type: 'number',
          description: 'Window used to resolve the target tab when tabId is omitted',
        },
        targetSelector: {
          type: 'string',
          description:
            'CSS selector for the paste target; defaults to the focused element or page editor',
        },
        selector: { type: 'string', description: 'Compatibility alias for targetSelector' },
        filePath: { type: 'string', description: 'Absolute local path to the image file' },
        fileUrl: { type: 'string', description: 'URL to download as an image before pasting' },
        base64Data: {
          type: 'string',
          description: 'Base64 image data, optionally with a data:image/... prefix',
        },
        fileName: { type: 'string', description: 'Filename used for base64 or URL data' },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_FORM_VALUE,
    description:
      'Read the actual DOM value of a form control, including React/Vue controlled inputs and textareas; this reads the value property rather than an HTML attribute or text node.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for an input, textarea, select, or contenteditable element',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID (default: most recently operated tab)',
        },
        windowId: {
          type: 'number',
          description: 'Window used to resolve the target tab when tabId is omitted',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.HANDLE_DIALOG,
    description: 'Handle JavaScript and beforeunload dialogs (alert/confirm/prompt) via CDP',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'accept | dismiss' },
        promptText: {
          type: 'string',
          description: 'Optional prompt text when accepting a prompt',
        },
        tabId: {
          type: 'number',
          description: 'Optional target tab ID; defaults to the active tab',
        },
        windowId: {
          type: 'number',
          description: 'Optional target window ID when resolving the active tab',
        },
      },
      required: ['action'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GIF_RECORDER,
    description:
      'Record browser tab activity as an animated GIF.\n\nModes:\n- Fixed FPS mode (action="start"): Captures frames at regular intervals. Good for animations/videos.\n- Auto-capture mode (action="auto_start"): Captures frames automatically when chrome_computer or chrome_navigate actions succeed. Better for interaction recordings with natural pacing.\n\nUse "stop" to end recording and save the GIF.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop', 'status', 'auto_start', 'capture', 'clear', 'export'],
          description:
            'Action to perform:\n- "start": Begin fixed-FPS recording (captures frames at regular intervals)\n- "auto_start": Begin auto-capture mode (frames captured on tool actions)\n- "stop": End recording and save GIF\n- "status": Get current recording state\n- "capture": Manually trigger a frame capture in auto mode\n- "clear": Clear all recording state and cached GIF without saving\n- "export": Export the last recorded GIF (download or drag&drop upload)',
        },
        tabId: {
          type: 'number',
          description:
            'Target tab ID (default: active tab). Used with "start"/"auto_start" for recording, and with "export" (download=false) for drag&drop upload target.',
        },
        fps: {
          type: 'number',
          description:
            'Frames per second for fixed-FPS mode (1-30, default: 5). Higher values = smoother but larger file.',
        },
        durationMs: {
          type: 'number',
          description:
            'Maximum recording duration in milliseconds (default: 5000, max: 60000). Only for fixed-FPS mode.',
        },
        maxFrames: {
          type: 'number',
          description:
            'Maximum number of frames to capture (default: 50 for fixed-FPS, 100 for auto mode, max: 300).',
        },
        width: {
          type: 'number',
          description: 'Output GIF width in pixels (default: 800, max: 1920).',
        },
        height: {
          type: 'number',
          description: 'Output GIF height in pixels (default: 600, max: 1080).',
        },
        maxColors: {
          type: 'number',
          description:
            'Maximum colors in palette (default: 256). Lower values = smaller file size.',
        },
        filename: {
          type: 'string',
          description: 'Output filename (without extension). Defaults to timestamped name.',
        },
        captureDelayMs: {
          type: 'number',
          description:
            'Auto-capture mode only: Delay in ms after action before capturing frame (default: 150). Allows UI to stabilize.',
        },
        frameDelayCs: {
          type: 'number',
          description:
            'Auto-capture mode only: Display duration per frame in centiseconds (default: 20 = 200ms per frame).',
        },
        annotation: {
          type: 'string',
          description:
            'Auto-capture mode only (action="capture"): Optional text label to render on the captured frame.',
        },
        download: {
          type: 'boolean',
          description:
            'Export action only: Set to true (default) to download the GIF, or false to upload via drag&drop.',
        },
        coordinates: {
          type: 'object',
          description:
            'Export action only (when download=false): Target coordinates for drag&drop upload.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
        ref: {
          type: 'string',
          description:
            'Export action only (when download=false): Element ref from chrome_read_page for drag&drop target.',
        },
        selector: {
          type: 'string',
          description:
            'Export action only (when download=false): CSS selector for drag&drop target element.',
        },
        enhancedRendering: {
          type: 'object',
          description:
            'Auto-capture mode only: Configure visual overlays for recorded actions (click indicators, drag paths, labels). Pass `true` to enable all defaults.',
          properties: {
            clickIndicators: {
              oneOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                      description: 'Enable click indicators (default: true)',
                    },
                    color: {
                      type: 'string',
                      description:
                        'CSS color for click indicator (default: "rgba(255, 87, 34, 0.8)")',
                    },
                    radius: { type: 'number', description: 'Initial radius in px (default: 20)' },
                    animationDurationMs: {
                      type: 'number',
                      description: 'Animation duration in ms (default: 400)',
                    },
                    animationFrames: {
                      type: 'number',
                      description: 'Number of animation frames (default: 3)',
                    },
                    animationIntervalMs: {
                      type: 'number',
                      description: 'Interval between animation frames in ms (default: 80)',
                    },
                  },
                },
              ],
              description:
                'Click indicator overlay config (true for defaults, or object for custom).',
            },
            dragPaths: {
              oneOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                      description: 'Enable drag path rendering (default: true)',
                    },
                    color: {
                      type: 'string',
                      description: 'CSS color for drag path (default: "rgba(33, 150, 243, 0.7)")',
                    },
                    lineWidth: { type: 'number', description: 'Line width in px (default: 3)' },
                    lineDash: {
                      type: 'array',
                      items: { type: 'number' },
                      description: 'Dash pattern (default: [6, 4])',
                    },
                    arrowSize: {
                      type: 'number',
                      description: 'Arrow head size in px (default: 10)',
                    },
                  },
                },
              ],
              description: 'Drag path overlay config (true for defaults, or object for custom).',
            },
            labels: {
              oneOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                      description: 'Enable action labels (default: true)',
                    },
                    font: {
                      type: 'string',
                      description: 'Font for labels (default: "bold 12px sans-serif")',
                    },
                    textColor: { type: 'string', description: 'Text color (default: "#fff")' },
                    bgColor: {
                      type: 'string',
                      description: 'Background color (default: "rgba(0,0,0,0.7)")',
                    },
                    padding: { type: 'number', description: 'Padding in px (default: 4)' },
                    borderRadius: {
                      type: 'number',
                      description: 'Border radius in px (default: 4)',
                    },
                    offset: {
                      type: 'object',
                      properties: { x: { type: 'number' }, y: { type: 'number' } },
                      description: 'Offset from action position (default: {x: 10, y: -20})',
                    },
                  },
                },
              ],
              description: 'Action label overlay config (true for defaults, or object for custom).',
            },
            durationMs: {
              type: 'number',
              description: 'How long overlays remain visible in ms (default: 1500).',
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
      'Extract the readable main article from a page using Readability. Returns clean text, article HTML, and metadata such as title, excerpt, author, site name, language, and length.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description:
            'Optional CSS selector. When provided, returns text from that element instead of Readability article extraction.',
        },
        tabId: { type: 'number', description: 'Target tab ID (default: active tab).' },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from (when tabId is omitted).',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SPA_FETCH,
    description:
      'Navigate to a SPA (Single Page Application) URL, wait for JS rendering, auto-scroll to trigger lazy content loading, then extract the full rendered text content. Designed for sites like X/Twitter, Reddit, and other JS-heavy pages where plain HTTP fetch returns no meaningful text.\n\nTypical usage: call once with url and maxScrolls=5-10, the tool handles scrolling and text extraction automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'Optional SPA URL. When omitted, read the current target tab without creating a new tab.',
        },
        maxScrolls: {
          type: 'number',
          description:
            'Maximum number of scroll-to-bottom passes (default: 5). Each pass scrolls to the bottom, waits for lazy content to load, then extracts text. Increase for feeds with infinite scroll (e.g. Twitter timeline).',
          default: 5,
        },
        scrollDelay: {
          type: 'number',
          description:
            'Delay in ms between scroll steps (default: 2000). Longer delays give more time for dynamic content to render.',
          default: 2000,
        },
        waitForSelector: {
          type: 'string',
          description:
            'Optional CSS selector to wait for before starting extraction (e.g. "[data-testid="tweet"]" for Twitter). If omitted, waits for body to be present and a 2s stabilization delay.',
        },
        waitTimeout: {
          type: 'number',
          description: 'Maximum time in ms to wait for waitForSelector (default: 20000).',
          default: 20000,
        },
        extractHtml: {
          type: 'boolean',
          description:
            'Whether to also return the rendered HTML content (default: false). Only text is returned by default.',
          default: false,
        },
        tabId: {
          type: 'number',
          description: 'Target an existing tab by ID (default: create new tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to create or reuse tab in.',
        },
        background: {
          type: 'boolean',
          description:
            'When a URL is provided, keep the target tab in the background. Defaults to false and activates it.',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_TAB_URL,
    description:
      'Get the current URL and title of a specified browser tab. Returns url, title, tabId, and favIconUrl. Simpler and faster than get_windows_and_tabs when you only need the current URL.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Target tab ID (default: active tab in current window).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from (when tabId is omitted).',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.GET_SCROLL_STATE,
    description:
      'Get the native state of the page or a scrollable container. Returns target, y, maxY, atTop, and atBottom. Fails explicitly when a requested scroll container cannot be found.',
    inputSchema: {
      type: 'object',
      properties: {
        containerSelector: {
          type: 'string',
          description:
            'CSS selector of the scroll container. Auto-detects the main container if omitted.',
        },
        anchorSelector: {
          type: 'string',
          description:
            'Optional CSS selector for content inside the intended scroll container. Improves auto-detection for nested or virtualized lists.',
        },
        frameSelector: {
          type: 'string',
          description:
            'Optional CSS selector for a same-origin iframe containing the scroll container.',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID (default: active tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from (when tabId is omitted).',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.SCROLL,
    description:
      'Scroll the page or a scrollable container. Supports multiple scroll modes:\n- Pixel scroll: specify amount (positive=down/right) and optional direction\n- Edge scroll: set toBottom=true or toTop=true\n- Element scroll: set selector to scroll an element into view\nWhen containerSelector is omitted, auto-detects the visible scrollable container; anchorSelector can identify content inside a nested or virtualized list.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['fast', 'human', 'humanFast', 'humanSlow'],
          description:
            'Scroll speed mode: fast (default), human, humanFast, or humanSlow. For the three human modes, omitted steps scale proportionally from 600px = 15 steps by distance, while the per-step interval stays constant at 50ms, 20ms, or 80ms respectively (independent of distance).',
        },
        humanLazyLoad: {
          type: 'boolean',
          description:
            'Human lazy-load optimization. Applies to human, humanFast, and humanSlow; after each paced scroll round, watches DOM/layout/resource changes and waits for the page to settle (default: false).',
        },
        amount: {
          type: 'number',
          description:
            'Pixels to scroll. Positive scrolls down/right, negative scrolls up/left. When direction is set without amount, fast defaults to 300 and the human modes default to 600.',
        },
        direction: {
          type: 'string',
          enum: ['down', 'up', 'left', 'right'],
          description: 'Scroll direction. Used with amount or defaults to 300px.',
        },
        steps: {
          type: 'number',
          description:
            'For pixel scrolling, split the movement into this many steps (fast default: 1; human modes default to 15 at 600px and auto-scale from amount when omitted; maximum: 50).',
        },
        intervalMs: {
          type: 'number',
          description:
            'For pixel scrolling, wait this many milliseconds between steps (fast default: 0; human, humanFast, and humanSlow keep a constant 50ms, 20ms, or 80ms per mode when omitted — independent of distance; maximum: 2000).',
        },
        toBottom: {
          type: 'boolean',
          description:
            'Scroll to the very bottom; in human modes, keep taking the selected human-paced steps until the bottom is stable or the request limit is reached.',
        },
        toTop: {
          type: 'boolean',
          description: 'Scroll to the very top of the scroll container.',
        },
        selector: {
          type: 'string',
          description:
            'CSS selector of an element to scroll into view. Uses scrollIntoView by default.',
        },
        scrollIntoView: {
          type: 'boolean',
          description:
            "When selector is given: use scrollIntoView (default: true). When false, sets the container scrollTop to the element's offsetTop.",
        },
        block: {
          type: 'string',
          enum: ['start', 'center', 'end', 'nearest'],
          description:
            'scrollIntoView vertical alignment (default: "center" when scrolling element into view).',
        },
        behavior: {
          type: 'string',
          enum: ['auto', 'smooth'],
          description:
            'Scroll behavior (default: "auto" for instant). Use "smooth" for animated scroll.',
        },
        containerSelector: {
          type: 'string',
          description:
            'CSS selector of the scroll container. When omitted, auto-detects the visible scrollable container.',
        },
        anchorSelector: {
          type: 'string',
          description:
            'Optional CSS selector for content inside the intended scroll container. Improves auto-detection for nested or virtualized lists.',
        },
        frameSelector: {
          type: 'string',
          description: 'Optional CSS selector for a same-origin iframe to scroll inside.',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID (default: active tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from (when tabId is omitted).',
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
          description: 'CSS selector of the element to wait for.',
        },
        waitFor: {
          type: 'string',
          enum: ['visible', 'present', 'hidden', 'gone', 'enabled'],
          description:
            'What to check:\n- "visible" (default): element exists AND is visible (offsetParent !== null)\n- "present": element exists in DOM\n- "hidden": element exists but is hidden\n- "gone": element does NOT exist in DOM\n- "enabled": element exists, is visible, and not disabled',
        },
        jsCondition: {
          type: 'string',
          description:
            'Custom JavaScript expression that returns boolean. Evaluated in the page context. Alternative to selector+waitFor. Example: \'document.querySelectorAll(".item").length >= 10\'',
        },
        frameSelector: {
          type: 'string',
          description:
            'Optional CSS selector for a same-origin iframe in which to evaluate the condition.',
        },
        timeout: {
          type: 'number',
          description: 'Maximum wait time in milliseconds (default: 10000, max: 120000).',
        },
        pollInterval: {
          type: 'number',
          description: 'Polling interval in milliseconds (default: 200, min: 50).',
        },
        stableForMs: {
          type: 'number',
          description:
            'Require the condition to remain true continuously for this many milliseconds before returning (default: 0).',
        },
        event: {
          type: 'string',
          enum: ['mutation', 'network'],
          description:
            'Event-driven wait. mutation observes DOM changes without polling; network waits for a matching response.',
        },
        observeSelector: {
          type: 'string',
          description: 'Mutation observer root; defaults to selector or body.',
        },
        urlPattern: { type: 'string', description: 'Network response URL substring to match.' },
        statusCode: { type: 'number', description: 'Optional exact network response status.' },
        needResponseBody: {
          type: 'boolean',
          description: 'For network event, return the matching response body when available.',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID (default: active tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from (when tabId is omitted).',
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.EXTRACT,
    description:
      'Extract structured data from a web page using CSS selectors. Supports nested field extraction, same-origin iframe targeting, table extraction, and configurable limits.\n\nExample:\n{\n  "selector": ".product-card",\n  "fields": [\n    { "name": "title", "selector": ".product-title", "type": "text" },\n    { "name": "price", "selector": ".price", "type": "number" },\n    { "name": "link", "selector": "a", "type": "href" }\n  ]\n}',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description:
            'CSS selector for elements to extract (each match becomes one item in the result array).',
        },
        fields: {
          type: 'array',
          description:
            'Fields to extract from each matched element. Each field defines a name, a relative CSS selector, and how to extract the value.',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Field name in the output object (required).',
              },
              selector: {
                type: 'string',
                description:
                  'CSS selector relative to the parent element. If omitted, uses the parent element itself.',
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
                  'How to extract the value:\n- "text" (default): element.textContent (trimmed); input/textarea/select fall back to the live value\n- "html": element.innerHTML\n- "outerHtml": element.outerHTML\n- "attribute": element.getAttribute(attribute); attribute="value" reads the live form value\n- "number": parseFloat(textContent) or null\n- "href": anchor.href (resolved absolute URL)\n- "src": img/video/iframe src (resolved absolute URL)\n- "table": table headers and rows, including colspan/rowspan',
              },
              attribute: {
                type: 'string',
                description:
                  'Attribute name when type is "attribute" (e.g. "href", "data-id", "alt").',
              },
              attr: {
                type: 'string',
                description: 'Compatibility alias for attribute; for example attr="value".',
              },
              multiple: {
                type: 'boolean',
                description:
                  'When true, returns an array of ALL matching sub-elements. When false (default), returns only the first match.',
              },
              defaultValue: {
                description: 'Fallback value when the selector produces no match (default: null).',
              },
            },
            required: ['name'],
          },
        },
        contextSelector: {
          type: 'string',
          description:
            'Optional parent container that narrows the extraction scope. Equivalent to calling document.querySelector(contextSelector).querySelectorAll(selector).',
        },
        frameSelector: {
          type: 'string',
          description: 'Optional CSS selector for a same-origin iframe to extract from.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: no limit).',
        },
        offset: {
          type: 'number',
          description: 'Skip the first N matched elements (default: 0).',
        },
        waitForSelector: {
          type: 'boolean',
          description:
            'When true, waits for the selector to appear in the DOM before extracting (default: true).',
        },
        waitTimeout: {
          type: 'number',
          description:
            'Maximum time in ms to wait for the selector to appear when waitForSelector is true (default: 5000).',
        },
        tabId: {
          type: 'number',
          description: 'Target tab ID (default: active tab).',
        },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from (when tabId is omitted).',
        },
      },
      required: ['selector', 'fields'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.CLICK_AND_WAIT,
    description:
      'Click a CSS-selected element, then wait for another selector to reach the requested state.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click.' },
        waitSelector: { type: 'string', description: 'CSS selector to wait for after clicking.' },
        waitFor: {
          type: 'string',
          enum: ['visible', 'present', 'hidden', 'gone', 'enabled'],
          description: 'Expected state for waitSelector (default: visible).',
        },
        waitTimeout: {
          type: 'number',
          description: 'Maximum wait time in milliseconds (default: 10000).',
        },
        tabId: { type: 'number', description: 'Target tab ID (default: active tab).' },
        windowId: {
          type: 'number',
          description: 'Target window ID to pick active tab from (when tabId is omitted).',
        },
        frameId: { type: 'number', description: 'Target frame ID for the click.' },
        frameSelector: {
          type: 'string',
          description: 'Optional same-origin iframe selector in which to wait.',
        },
      },
      required: ['selector', 'waitSelector'],
    },
  },
  {
    name: TOOL_NAMES.BROWSER.PASTE_TEXT,
    description:
      'Paste multi-paragraph text into a rich-text editor via a synthesized ClipboardEvent("paste") carrying a DataTransfer (built for Draft.js editors such as Zhihu and Medium). The editor receives the text through its native paste path, so every paragraph is kept, and no window focus or system clipboard is required. Use this instead of chrome_computer type (breaks with newlines), execCommand("insertText") (keeps only the last paragraph), or the Clipboard API (rejected without focus). After pasting, reload the page to verify the draft, then click the publish button.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description:
            'Text to paste; may contain newlines, blank lines become separate paragraphs.',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the editor element; defaults to [contenteditable="true"].',
        },
        tabId: { type: 'number' },
        windowId: { type: 'number' },
      },
      required: ['text'],
    },
  },
];

const EN_TOOL_DESCRIPTIONS: Record<string, string> = {
  collect_virtual_list:
    'Extract and deduplicate records from a dynamic or virtualized list with container scrolling, adaptive waits, resumable state, batches, and progress snapshots.',
  collect_virtual_lists:
    'Collect dynamic or virtualized lists concurrently from multiple tabs or windows, returning per-target results, state, batches, progress, and failures.',
  wait_extract_response:
    'Wait for a JSON response after navigation or a click, then extract records using caller-provided JSONPath rules.',
  capture_debug_bundle:
    'Save a failure snapshot to Downloads containing a screenshot, DOM, console logs, a redacted network summary, and metadata.',
  resume_tab_task:
    'Save, read, or clear caller state for a normal browser tab; it never creates an incognito window or reads cookies.',
  chrome_find_and_click:
    'Try CSS, XPath, and text candidates within an optional scope, then click the first visible and enabled match.',
  chrome_expand_section:
    'Expand a collapsible section and wait for its content selector to appear.',
  chrome_scan_for_section:
    'Scroll to find a target section, optionally rescanning upward, and return traversal state only.',
  chrome_paginate_extract:
    'Extract the current page, click the requested next-page candidate, and continue only after the card HTML changes.',
  chrome_extract_records:
    'Extract caller-selected raw fields from cards and exclude records using case-insensitive text rules.',
  detect_empty_state:
    'Classify a region as has_content, empty, or loading_or_unknown from selectors and text markers.',
  merge_records:
    'Merge records using caller-provided identity fields and source priority without reading or persisting browser state.',
  chrome_list_frames:
    'List frames in a tab so scoped actions can target same-origin or cross-origin iframes by frameId.',
  chrome_diagnostic_snapshot:
    'Return a diagnostic snapshot containing a viewport screenshot, DOM snapshot, console buffer, and network-capture summary.',
  chrome_proxy_diagnostics:
    'Read proxy configuration and Chrome takeover state; action=test also verifies the proxy exit IP without returning credentials.',
  chrome_proxy_rotate:
    'Rotate the proxy session and reload the tab after the caller confirms the current page is abnormal.',
  chrome_scoped_action:
    'Click, extract, or paginate within a semantic scope, including open Shadow DOM and iframe targeting by frameId.',
  chrome_task_context:
    'Create an isolated incognito task window and persist its tabs and caller-defined extraction state across MCP restarts.',
  chrome_network_capture:
    'Capture network requests with start and stop actions; optionally collect response bodies through the Debugger API.',
  chrome_block_resources:
    'Block selected resource types or URL patterns in a tab until blocking is stopped.',
  chrome_get_interactive_elements:
    'List interactive elements in the current page, optionally filtered by selector and element type.',
  chrome_wait:
    'Wait for a DOM element, JavaScript condition, or mutation/network event to satisfy the requested state.',
  chrome_paste_text:
    'Paste multi-paragraph text into a rich-text editor (Draft.js such as Zhihu/Medium) by dispatching a synthesized ClipboardEvent("paste") with a DataTransfer, so the editor receives it via its native paste path without needing window focus.',
};

const EN_PARAMETER_DESCRIPTIONS: Record<string, string> = {
  action: 'Operation to perform.',
  cardSelector: 'CSS selector for the cards to inspect.',
  fields: 'Fields to extract from each matched card.',
  identityFields: 'Field names that uniquely identify a record.',
  maxItems: 'Maximum number of records to return.',
  maxDurationMs: 'Maximum collection duration in milliseconds.',
  returnBatches: 'Whether to return records grouped into batches.',
  batchSize: 'Number of records per returned batch.',
  returnProgress: 'Whether to return scroll progress snapshots.',
  progressEverySteps: 'Record one progress snapshot every N scroll steps.',
  containerSelector: 'CSS selector for the nested scroll container.',
  anchorSelector: 'CSS selector for content used to auto-detect the scroll container.',
  targets: 'Array of tab or window targets to collect.',
  maxConcurrency: 'Maximum number of targets collected concurrently.',
  failFast: 'Whether to stop starting new targets after the first failure.',
  scroll: 'Scrolling options used while loading more list items.',
  state: 'Caller-defined JSON-safe state to save or resume.',
  response: 'Rules for matching the target JSON response.',
  extract: 'JSONPath rules for extracting records from the response.',
  reason: 'Reason the diagnostic bundle or proxy rotation was requested.',
  domLimit: 'Maximum number of DOM characters to include.',
  consoleLimit: 'Maximum number of console entries to include.',
  taskId: 'Stable caller-defined task ID.',
  candidates: 'Candidate selectors or visible text values to try in order.',
  scopeSelector: 'CSS selector for the owning region.',
  waitSelector: 'CSS selector to wait for after the action.',
  waitFor: 'Expected state for the target element.',
  waitTimeout: 'Maximum wait time in milliseconds.',
  trigger: 'Selector or reference for the control that expands the section.',
  expandedAttribute: 'Attribute or state that indicates the section is expanded.',
  contentSelector: 'CSS selector for the section content.',
  targetSelector: 'CSS selector for the section to find.',
  stopSelector: 'Stop when this selector appears.',
  direction: 'Scroll direction.',
  step: 'Pixels to move on each scroll step.',
  maxSteps: 'Maximum number of scroll steps.',
  rescanUpSteps: 'Number of upward rescan steps after reaching the target area.',
  waitAfterScrollMs: 'Milliseconds to wait after each scroll step.',
  next: 'Selector or reference for the next-page control.',
  expectedCount: 'Expected number of records on the current page.',
  pageSize: 'Expected number of records per page.',
  maxPages: 'Maximum number of pages to process.',
  changeMode: 'Rule used to determine whether the page changed.',
  excludeIfTextMatches: 'Case-insensitive text patterns that exclude a record.',
  includeOuterHtml: 'Whether to include each card outer HTML.',
  emptyTextMarkers: 'Text markers that indicate an empty state.',
  countSelector: 'CSS selector used to count content items.',
  sources: 'Record sources to merge in priority order.',
  textNormalize: 'Whether to normalize text before comparing identity fields.',
  dateToleranceDays: 'Allowed date difference when matching records.',
  fieldPriority: 'Source priority for conflicting fields.',
  allowSourceOnlyRecords: 'Whether to keep records found in only one source.',
  resourceTypes: 'Resource types to block.',
  urlPatterns: 'CDP URL wildcard patterns to block.',
  textQuery: 'Optional visible text filter.',
  selector: 'CSS selector for the target elements.',
  includeCoordinates: 'Whether to include element coordinates.',
  types: 'Interactive element types to include.',
  tabId: 'Target tab ID; defaults to the active tab.',
  windowId: 'Target window ID used to choose the active tab.',
  frameSelector: 'Optional same-origin iframe selector.',
  intent: 'Optional intent shown in the browser status overlay.',
  expectedUrl: 'Only execute when the target tab URL starts with this value.',
  profileId: 'Optional isolated browser profile ID; omit it to control the current Chrome.',
  actionPolicy: 'Unified action pacing: fast, balanced (default), or human.',
};

const humanizeParameter = (name: string) =>
  name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^[a-z]/, (letter) => letter.toUpperCase());

function fillEnglishDescriptions(schema: Record<string, any>, name: string) {
  if (!schema.description || /\p{Script=Han}/u.test(schema.description)) {
    schema.description = EN_PARAMETER_DESCRIPTIONS[name] ?? `${humanizeParameter(name)} parameter.`;
  }
  for (const [childName, childSchema] of Object.entries(schema.properties ?? {})) {
    fillEnglishDescriptions(childSchema as Record<string, any>, childName);
  }
  if (schema.items && typeof schema.items === 'object') {
    fillEnglishDescriptions(schema.items as Record<string, any>, `${name} item`);
  }
}

for (const tool of TOOL_SCHEMAS_EN) {
  if (EN_TOOL_DESCRIPTIONS[tool.name]) tool.description = EN_TOOL_DESCRIPTIONS[tool.name];
  (tool.inputSchema as any).properties.intent = {
    type: 'string',
    description: 'Optional intent for the current operation, shown in the browser status overlay.',
  };
  (tool.inputSchema as any).properties.expectedUrl = {
    type: 'string',
    description:
      'Only execute when the target tab URL starts with this value; otherwise the call is rejected.',
  };
  if (tool.name !== TOOL_NAMES.BROWSER.PROFILE) {
    (tool.inputSchema as any).properties.profileId = {
      type: 'string',
      description: 'Optional isolated browser profile ID; omit it to control the current Chrome.',
    };
    (tool.inputSchema as any).properties.actionPolicy = {
      type: 'string',
      enum: ['fast', 'balanced', 'human'],
      default: 'balanced',
      description: 'Unified action pacing: fast, balanced (default), or human.',
    };
  }
  for (const [name, schema] of Object.entries((tool.inputSchema as any).properties)) {
    fillEnglishDescriptions(schema as Record<string, any>, name);
  }
}
