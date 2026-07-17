import { createErrorResponse } from '@/common/tool-handler';
import { ERROR_MESSAGES } from '@/common/constants';
import * as browserTools from './browser';
import { flowRunTool, listPublishedFlowsTool } from './record-replay';

const tools = { ...browserTools, flowRunTool, listPublishedFlowsTool } as any;
const toolsMap = new Map(Object.values(tools).map((tool: any) => [tool.name, tool]));

/**
 * Tool call parameter interface
 */
export interface ToolCallParam {
  name: string;
  args: any;
}

const WRITE_TOOL = /(?:navigate|click|scroll|fill|keyboard|key|dialog|computer|upload)/;

function compact(value: unknown, max = 72): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function duration(value: unknown, fallbackMs: number): string {
  const ms = typeof value === 'number' && value >= 0 ? value : fallbackMs;
  return `${ms / 1000} 秒`;
}

function target(args: Record<string, unknown>): string {
  const selector = compact(args.selector);
  if (selector) return selector;
  const ref = compact(args.ref);
  if (ref) return `元素引用 ${ref}`;
  const coordinates = args.coordinates as { x?: unknown; y?: unknown } | undefined;
  if (typeof coordinates?.x === 'number' && typeof coordinates.y === 'number')
    return `坐标 (${coordinates.x}, ${coordinates.y})`;
  return '当前目标';
}

function operationDetail(param: ToolCallParam): string {
  const args = (param.args || {}) as Record<string, unknown>;
  switch (param.name) {
    case 'get_windows_and_tabs':
      return '读取所有窗口和标签页';
    case 'search_tabs_content':
      return `搜索：${compact(args.query || args.text) || '标签页内容'}`;
    case 'chrome_screenshot':
      return args.fullPage ? '截取整页' : `截取：${target(args)}`;
    case 'chrome_close_tabs':
      return `关闭 ${Array.isArray(args.tabIds) ? args.tabIds.length : 1} 个标签页`;
    case 'chrome_switch_tab':
      return `切换到标签页 #${args.tabId || '当前'}`;
    case 'chrome_get_web_content':
      return `读取 ${args.htmlContent ? 'HTML' : '文本'}：${compact(args.url) || target(args)}`;
    case 'chrome_get_interactive_elements':
      return `搜索可交互元素${compact(args.textQuery) ? `：${compact(args.textQuery)}` : ''}`;
    case 'chrome_request_element_selection': {
      const names = Array.isArray(args.requests)
        ? args.requests
            .map((request: { name?: unknown }) => compact(request?.name, 30))
            .filter(Boolean)
        : [];
      return `选择 ${names.slice(0, 3).join('、') || '页面元素'}${names.length > 3 ? ' 等' : ''}（最多 ${duration(args.timeoutMs, 180_000)}）`;
    }
    case 'chrome_click_element':
      return `目标：${target(args)}`;
    case 'chrome_click_and_wait':
      return `点击：${target(args)}；等待 ${compact(args.waitSelector) || '目标元素'} ${args.waitFor || 'visible'}（最多 ${duration(args.waitTimeout, 10_000)}）`;
    case 'chrome_wait':
      return `等待 ${compact(args.jsCondition) || target(args)} ${args.waitFor || 'visible'}（最多 ${duration(args.timeout, 10_000)}）`;
    case 'chrome_fill_or_select':
      return `目标：${target(args)}`;
    case 'chrome_keyboard':
      return `向 ${target(args)} 发送键盘输入（内容已隐藏）`;
    case 'chrome_upload_file':
      return `上传文件到：${target(args)}`;
    case 'chrome_read_page':
      return args.filter === 'interactive' ? '读取页面交互元素' : '读取页面可见元素';
    case 'chrome_get_page_text':
      return `读取正文：${target(args)}`;
    case 'chrome_extract':
      return `提取范围：${target(args)}`;
    case 'chrome_scroll': {
      const container = compact(args.containerSelector);
      return args.toBottom
        ? `${container ? `在 ${container} 中` : ''}滚动到底部`
        : args.toTop
          ? `${container ? `在 ${container} 中` : ''}滚动到顶部`
          : args.scrollIntoView
            ? `滚动到：${target(args)}`
            : `${container ? `在 ${container} 中` : ''}向 ${args.direction || '下'} 滚动 ${args.amount || 300}px`;
    }
    case 'chrome_navigate':
      return `前往：${compact(args.url) || '目标页面'}`;
    case 'chrome_network_capture':
      return `${args.action === 'start' ? '开始' : '停止'}网络抓包`;
    case 'chrome_block_images':
      return args.action === 'start' ? '阻止图片网络请求' : '恢复图片网络请求';
    case 'chrome_network_capture_start':
    case 'chrome_network_debugger_start':
      return '开始网络抓包';
    case 'chrome_network_capture_stop':
    case 'chrome_network_debugger_stop':
      return '停止网络抓包';
    case 'chrome_network_request':
      return `发起 ${args.method || 'GET'} 网络请求`;
    case 'chrome_history':
      return `搜索历史记录${compact(args.text) ? `：${compact(args.text)}` : ''}`;
    case 'chrome_bookmark_search':
      return `搜索书签${compact(args.query) ? `：${compact(args.query)}` : ''}`;
    case 'chrome_bookmark_add':
      return '添加书签';
    case 'chrome_bookmark_delete':
      return '删除书签';
    case 'chrome_handle_dialog':
      return args.action === 'accept' ? '确认页面对话框' : '关闭页面对话框';
    case 'chrome_handle_download':
      return `处理下载${compact(args.action) ? `：${compact(args.action)}` : ''}`;
    case 'chrome_computer':
      return `模拟 ${compact(args.action) || '鼠标'} 操作：${target(args)}`;
    case 'chrome_inject_script':
    case 'chrome_javascript':
      return '执行页面脚本（内容已隐藏）';
    case 'chrome_send_command_to_inject_script':
      return '向页面脚本发送命令';
    case 'chrome_console':
      return '读取页面控制台';
    case 'chrome_userscript':
      return `管理用户脚本：${compact(args.action) || '操作'}`;
    case 'performance_start_trace':
      return args.reload ? '开始性能追踪并刷新页面' : '开始性能追踪';
    case 'performance_stop_trace':
      return '停止性能追踪';
    case 'performance_analyze_insight':
      return '分析性能追踪结果';
    case 'chrome_gif_recorder':
      return `${compact(args.action) || '开始'} GIF 录制${args.durationMs ? `（${duration(args.durationMs, 0)}）` : ''}`;
    case 'chrome_get_tab_url':
      return '读取当前标签页地址';
    case 'record_replay_flow_run':
      return '运行录制流程';
    case 'record_replay_list_published':
      return '读取已发布流程';
    default:
      return '';
  }
}

async function showOperation(param: ToolCallParam, state: '执行中' | '完成' | '失败') {
  const tabId = param.args?.tabId;
  const tab =
    typeof tabId === 'number'
      ? await chrome.tabs.get(tabId)
      : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.id) return;

  await chrome.scripting
    .executeScript({
      target: {
        tabId: tab.id,
        ...(typeof param.args?.frameId === 'number' ? { frameIds: [param.args.frameId] } : {}),
      },
      args: [
        param.name,
        param.args?.selector ??
          (param.name === 'chrome_scroll' ? (param.args?.containerSelector ?? null) : null),
        param.args?.ref ?? null,
        param.args?.coordinates ?? null,
        state,
        operationDetail(param),
      ],
      func: (name, selector, ref, coordinates, state, detail) => {
        const statusId = '__mcp_operation_status__';
        const highlightId = '__mcp_operation_highlight__';
        const root = document.documentElement || document.body;
        let status = document.getElementById(statusId);
        if (!status) {
          status = document.createElement('div');
          status.id = statusId;
          Object.assign(status.style, {
            position: 'fixed',
            left: '16px',
            bottom: '16px',
            zIndex: '2147483647',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(17, 24, 39, .9)',
            color: '#fff',
            font: '13px/1.4 system-ui, sans-serif',
            whiteSpace: 'pre-line',
            maxWidth: '360px',
            pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,.25)',
          });
          root.append(status);
        }
        const actionLabels: Record<string, string> = {
          chrome_scroll: '滚动',
          chrome_click_element: '点击',
          chrome_click_and_wait: '点击并等待',
          chrome_fill_or_select: '输入或选择',
          chrome_get_interactive_elements: '搜索元素',
          chrome_request_element_selection: '选择范围',
          chrome_wait: '等待',
          chrome_extract: '提取数据',
          chrome_navigate: '打开页面',
          get_windows_and_tabs: '读取标签页',
          search_tabs_content: '搜索内容',
          chrome_screenshot: '截图',
          chrome_close_tabs: '关闭标签页',
          chrome_switch_tab: '切换标签页',
          chrome_get_web_content: '读取网页',
          chrome_keyboard: '键盘输入',
          chrome_upload_file: '上传文件',
          chrome_read_page: '读取页面',
          chrome_get_page_text: '读取正文',
          chrome_network_capture: '网络抓包',
          chrome_network_capture_start: '开始抓包',
          chrome_network_capture_stop: '停止抓包',
          chrome_network_debugger_start: '开始抓包',
          chrome_network_debugger_stop: '停止抓包',
          chrome_network_request: '网络请求',
          chrome_history: '搜索历史',
          chrome_bookmark_search: '搜索书签',
          chrome_bookmark_add: '添加书签',
          chrome_bookmark_delete: '删除书签',
          chrome_handle_dialog: '处理对话框',
          chrome_handle_download: '处理下载',
          chrome_computer: '模拟操作',
          chrome_inject_script: '注入脚本',
          chrome_javascript: '执行脚本',
          chrome_send_command_to_inject_script: '发送脚本命令',
          chrome_console: '读取控制台',
          chrome_userscript: '管理用户脚本',
          performance_start_trace: '开始性能追踪',
          performance_stop_trace: '停止性能追踪',
          performance_analyze_insight: '分析性能',
          chrome_gif_recorder: 'GIF 录制',
          chrome_get_tab_url: '读取地址',
          record_replay_flow_run: '运行流程',
          record_replay_list_published: '读取流程',
        };
        let target: Element | null = null;
        try {
          target = selector ? document.querySelector(String(selector)) : null;
        } catch {}
        if (!target && ref) {
          const map = (window as any).__claudeElementMap;
          const value = map instanceof Map ? map.get(ref) : map?.[ref];
          target =
            value instanceof Element
              ? value
              : value?.element instanceof Element
                ? value.element
                : null;
        }
        const elementName = target
          ? [
              target.getAttribute('aria-label'),
              target.getAttribute('title'),
              target.textContent?.trim().replace(/\s+/g, ' '),
            ]
              .find((value) => value)
              ?.slice(0, 72)
          : '';
        if (elementName && (name === 'chrome_click_element' || name === 'chrome_click_and_wait')) {
          const expanded = target?.getAttribute('aria-expanded');
          const action = expanded === 'false' ? '展开' : expanded === 'true' ? '收起' : '点击';
          const separator = String(detail).indexOf('；');
          const wait =
            name === 'chrome_click_and_wait' && separator >= 0
              ? String(detail).slice(separator)
              : '';
          detail = `${action}：${elementName}${wait}`;
        } else if (elementName && name === 'chrome_scroll' && String(detail).startsWith('滚动到')) {
          detail = `滚动到：${elementName}`;
        } else if (elementName) {
          const targetLabels: Record<string, string> = {
            chrome_fill_or_select: '目标',
            chrome_extract: '提取范围',
            chrome_get_page_text: '读取正文',
            chrome_screenshot: '截取',
            chrome_upload_file: '上传到',
          };
          if (targetLabels[name]) detail = `${targetLabels[name]}：${elementName}`;
        }
        status.textContent = `${state}：${actionLabels[name] || String(name).replace(/^chrome_/, '')}${detail ? `\n${detail}` : ''}`;

        const rect = target?.getBoundingClientRect();
        const x = rect?.left ?? Number((coordinates as any)?.x);
        const y = rect?.top ?? Number((coordinates as any)?.y);
        const width = rect?.width ?? ((coordinates as any) ? 28 : 0);
        const height = rect?.height ?? ((coordinates as any) ? 28 : 0);
        let highlight = document.getElementById(highlightId);
        if (Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0) {
          if (!highlight) {
            highlight = document.createElement('div');
            highlight.id = highlightId;
            Object.assign(highlight.style, {
              position: 'fixed',
              zIndex: '2147483646',
              pointerEvents: 'none',
              border: '3px solid #f97316',
              borderRadius: '5px',
              background: 'rgba(249,115,22,.12)',
              boxShadow: '0 0 0 2px rgba(255,255,255,.9)',
            });
            root.append(highlight);
          }
          Object.assign(highlight.style, {
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
            display: 'block',
          });
        }
        const key = '__mcpOperationOverlayTimer__';
        clearTimeout((window as any)[key]);
        if (state !== '执行中')
          (window as any)[key] = setTimeout(() => {
            status?.remove();
            highlight?.remove();
          }, 1800);
      },
    })
    .catch(() => undefined);
}

async function checkExpectedUrl(param: ToolCallParam): Promise<string | null> {
  const expectedUrl = String(param.args?.expectedUrl || '');
  if (!expectedUrl || !WRITE_TOOL.test(param.name)) return null;
  const tabId = param.args?.tabId;
  const tab =
    typeof tabId === 'number'
      ? await chrome.tabs.get(tabId)
      : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.url?.startsWith(expectedUrl))
    return `Expected URL prefix ${expectedUrl}, got ${tab?.url || 'none'}`;
  return null;
}

/**
 * Handle tool execution
 */
export const handleCallTool = async (param: ToolCallParam, signal?: AbortSignal) => {
  const tool = toolsMap.get(param.name);
  if (!tool) {
    return createErrorResponse(`Tool ${param.name} not found`);
  }

  try {
    if (signal?.aborted) return createErrorResponse('Tool call cancelled');
    const urlError = await checkExpectedUrl(param);
    if (urlError) return createErrorResponse(urlError);
    const args = { ...(param.args || {}) };
    if (args.background === undefined) {
      const { backgroundOperations = true } =
        await chrome.storage.local.get('backgroundOperations');
      args.background = backgroundOperations;
    }
    await showOperation(param, '执行中');
    const result = await tool.execute(args, signal);
    void showOperation(param, result.isError ? '失败' : '完成');
    return result;
  } catch (error) {
    void showOperation(param, '失败');
    console.error(`Tool execution failed for ${param.name}:`, error);
    return createErrorResponse(
      error instanceof Error ? error.message : ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
    );
  }
};
