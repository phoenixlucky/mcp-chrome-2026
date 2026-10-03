import { createErrorResponse, type ToolProgressReporter } from '@/common/tool-handler';
import { ERROR_MESSAGES } from '@/common/constants';
import type { ToolResult } from '@/common/tool-handler';
import { resolveActionPolicy, runWithActionPolicy } from './action-policy';
import * as browserTools from './browser';
import { pauseSpaFetchTabCleanup, scheduleSpaFetchTabCleanup } from './browser/spa-fetch';
import { createToolRegistry } from './tool-registry';

const browserToolNames = [
  'navigateTool',
  'closeTabsTool',
  'switchTabTool',
  'createTabTool',
  'hoverTool',
  'printToPdfTool',
  'elementInfoTool',
  'storageGetTool',
  'storageSetTool',
  'storageDeleteTool',
  'windowTool',
  'cookieGetTool',
  'cookieSetTool',
  'cookieDeleteTool',
  'searchTabsContentTool',
  'screenshotTool',
  'webFetcherTool',
  'getInteractiveElementsTool',
  'clickTool',
  'fillTool',
  'elementLocatorTool',
  'elementPickerTool',
  'selectAllItemsTool',
  'networkRequestTool',
  'networkCaptureTool',
  'blockImagesTool',
  'blockResourcesTool',
  'keyboardTool',
  'historyTool',
  'bookmarkSearchTool',
  'bookmarkAddTool',
  'bookmarkDeleteTool',
  'javascriptTool',
  'pasteTextTool',
  'consoleTool',
  'fileUploadTool',
  'pasteImageTool',
  'formValueTool',
  'readPageTool',
  'actionSnapshotTool',
  'computerTool',
  'postToXTool',
  'handleDialogTool',
  'handleDownloadTool',
  'userscriptTool',
  'performanceStartTraceTool',
  'performanceStopTraceTool',
  'performanceAnalyzeInsightTool',
  'gifRecorderTool',
  'getTabUrlTool',
  'scrollStateTool',
  'scrollTool',
  'waitTool',
  'extractTool',
  'pageTextTool',
  'spaFetchTool',
  'clickAndWaitTool',
  'taskContextTool',
  'scopedActionTool',
  'diagnosticSnapshotTool',
  'errorLogsTool',
  'proxyDiagnosticsTool',
  'proxyRotateTool',
  'listFramesTool',
  'captureDebugBundleTool',
  'collectVirtualListTool',
  'collectVirtualListsTool',
  'crawlLinksTool',
  'extractThreadTool',
  'resumeTabTaskTool',
  'waitExtractResponseTool',
  'detectEmptyStateTool',
  'extractReviewSummaryTool',
  'expandSectionTool',
  'extractRecordsTool',
  'findAndClickTool',
  'mergeRecordsTool',
  'paginateExtractTool',
  'scanForSectionTool',
] as const satisfies readonly (keyof typeof browserTools)[];

export const browserToolExports = browserToolNames.flatMap((name) =>
  name in browserTools ? [browserTools[name]] : [],
);

const toolsMap = createToolRegistry(browserToolExports);

/**
 * Tool call parameter interface
 */
export interface ToolCallParam {
  name: string;
  args: Record<string, unknown>;
}

function compact(value: unknown, max = 72): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function isCoordinates(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false;
  const coordinates = value as { x?: unknown; y?: unknown };
  return (
    typeof coordinates.x === 'number' &&
    Number.isFinite(coordinates.x) &&
    typeof coordinates.y === 'number' &&
    Number.isFinite(coordinates.y)
  );
}

function duration(value: unknown, fallbackMs: number): string {
  const ms = typeof value === 'number' && value >= 0 ? value : fallbackMs;
  return `${ms / 1000}s`;
}

function target(args: Record<string, unknown>): string {
  const selector = compact(args.selector);
  if (selector) return selector;
  const ref = compact(args.ref);
  if (ref) return `Element ref ${ref}`;
  const coordinates = args.coordinates as { x?: unknown; y?: unknown } | undefined;
  if (typeof coordinates?.x === 'number' && typeof coordinates.y === 'number')
    return `Coordinates (${coordinates.x}, ${coordinates.y})`;
  return 'Current target';
}

function operationDetail(param: ToolCallParam): string {
  const args = (param.args || {}) as Record<string, unknown>;
  switch (param.name) {
    case 'get_windows_and_tabs':
      return 'Read all windows and tabs';
    case 'chrome_create_tab':
      return `Create tab${compact(args.url) ? `: ${compact(args.url)}` : ''}`;
    case 'chrome_hover':
      return `Hover: ${target(args)}`;
    case 'chrome_get_element_info':
      return `Query element: ${target(args)}`;
    case 'chrome_print_to_pdf':
      return 'Print to PDF';
    case 'chrome_storage_get':
      return 'Read page storage';
    case 'chrome_storage_set':
      return 'Write page storage';
    case 'chrome_storage_delete':
      return 'Delete page storage';
    case 'search_tabs_content':
      return `Search: ${compact(args.query || args.text) || 'tab content'}`;
    case 'chrome_screenshot':
      return args.fullPage ? 'Screenshot full page' : `Screenshot: ${target(args)}`;
    case 'chrome_close_tabs':
      return `Close ${Array.isArray(args.tabIds) ? args.tabIds.length : 1} tabs`;
    case 'chrome_switch_tab':
      return `Switch to tab #${args.tabId || 'current'}`;
    case 'chrome_get_web_content':
      return `Read ${args.htmlContent ? 'HTML' : 'text'}: ${compact(args.url) || target(args)}`;
    case 'chrome_get_interactive_elements':
      return `Search interactive elements${compact(args.textQuery) ? `: ${compact(args.textQuery)}` : ''}`;
    case 'chrome_request_element_selection': {
      const names = Array.isArray(args.requests)
        ? args.requests
            .map((request: { name?: unknown }) => compact(request?.name, 30))
            .filter(Boolean)
        : [];
      return `Select ${names.slice(0, 3).join(', ') || 'page elements'}${names.length > 3 ? ' and more' : ''} (up to ${duration(args.timeoutMs, 180_000)})`;
    }
    case 'chrome_click_element':
      return `Target: ${target(args)}`;
    case 'chrome_click_and_wait':
      return `Click: ${target(args)}; wait ${compact(args.waitSelector) || 'target element'} ${args.waitFor || 'visible'} (up to ${duration(args.waitTimeout, 10_000)})`;
    case 'chrome_wait':
      return `Wait ${compact(args.jsCondition) || target(args)} ${args.waitFor || 'visible'} (up to ${duration(args.timeout, 10_000)})`;
    case 'chrome_fill_or_select':
      return `Target: ${target(args)}`;
    case 'chrome_keyboard':
      return `Type into ${target(args)} (content hidden)`;
    case 'chrome_upload_file':
      return `Upload file to: ${target(args)}`;
    case 'chrome_read_page':
      return args.filter === 'interactive'
        ? 'Read interactive page elements'
        : 'Read visible page elements';
    case 'chrome_get_page_text':
      return `Read body text: ${target(args)}`;
    case 'chrome_spa_fetch':
      return `SPA extract: ${compact(args.url) || target(args)} (${args.maxScrolls || 5} scrolls)`;
    case 'chrome_extract':
      return `Extract scope: ${target(args)}`;
    case 'chrome_scroll': {
      const container = compact(args.containerSelector);
      const scrolled = `Scrolled ${args.direction || 'down'} by ${args.amount || 300}px`;
      return args.toBottom
        ? `${container ? `In ${container}, scrolled to bottom` : 'Scrolled to bottom'}`
        : args.toTop
          ? `${container ? `In ${container}, scrolled to top` : 'Scrolled to top'}`
          : args.scrollIntoView
            ? `Scrolled to: ${target(args)}`
            : `${container ? `${scrolled} in ${container}` : scrolled}`;
    }
    case 'chrome_navigate':
      return `Go to: ${compact(args.url) || 'target page'}`;
    case 'chrome_network_capture':
      return `${args.action === 'start' ? 'Start' : 'Stop'} network capture`;
    case 'chrome_block_images':
      return args.action === 'start' ? 'Block image requests' : 'Restore image requests';
    case 'chrome_network_capture_start':
    case 'chrome_network_debugger_start':
      return 'Start network capture';
    case 'chrome_network_capture_stop':
    case 'chrome_network_debugger_stop':
      return 'Stop network capture';
    case 'chrome_network_request':
      return `Send ${args.method || 'GET'} network request`;
    case 'chrome_history':
      return `Search history${compact(args.text) ? `: ${compact(args.text)}` : ''}`;
    case 'chrome_bookmark_search':
      return `Search bookmarks${compact(args.query) ? `: ${compact(args.query)}` : ''}`;
    case 'chrome_bookmark_add':
      return 'Add bookmark';
    case 'chrome_bookmark_delete':
      return 'Delete bookmark';
    case 'chrome_handle_dialog':
      return args.action === 'accept' ? 'Accept page dialog' : 'Dismiss page dialog';
    case 'chrome_handle_download':
      return `Handle download${compact(args.action) ? `: ${compact(args.action)}` : ''}`;
    case 'chrome_computer':
      return `Simulate ${compact(args.action) || 'mouse'} action: ${target(args)}`;
    case 'chrome_post_to_x':
      return `Post to X: ${compact(args.text, 60) || 'body'}`;
    case 'chrome_javascript':
      return 'Run page script (content hidden)';
    case 'chrome_paste_text':
      return `Synthesize paste into ${target(args)}`;
    case 'chrome_console':
      return 'Read page console';
    case 'chrome_userscript':
      return `Manage userscripts: ${compact(args.action) || 'action'}`;
    case 'performance_start_trace':
      return args.reload ? 'Start performance trace and reload page' : 'Start performance trace';
    case 'performance_stop_trace':
      return 'Stop performance trace';
    case 'performance_analyze_insight':
      return 'Analyze performance trace';
    case 'chrome_gif_recorder':
      return `${compact(args.action) || 'Start'} GIF recording${args.durationMs ? ` (${duration(args.durationMs, 0)})` : ''}`;
    case 'chrome_get_tab_url':
      return 'Read current tab URL';
    case 'chrome_proxy_rotate':
      return `Rotate proxy and reload page${compact(args.reason) ? `: ${compact(args.reason)}` : ''}`;
    case 'chrome_get_scroll_state':
      return 'Read scroll state';
    case 'chrome_extract_review_summary':
      return 'Extract product review summary';
    default:
      return '';
  }
}

async function showOperation(param: ToolCallParam, state: 'Running' | 'Done' | 'Failed') {
  const tabId = param.args?.tabId;
  let tab: chrome.tabs.Tab | undefined;
  try {
    tab =
      typeof tabId === 'number'
        ? await chrome.tabs.get(tabId)
        : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  } catch {
    return;
  }
  if (!tab?.id) return;

  // The overlay is best-effort; only pass primitives so malformed tool input cannot block the tool.
  const selector =
    compact(param.args?.selector) ||
    (param.name === 'chrome_scroll' ? compact(param.args?.containerSelector) : '') ||
    null;
  const coordinates = param.args?.coordinates;
  const safeCoordinates = isCoordinates(coordinates) ? coordinates : null;
  const intent = compact(param.args?.intent, 160) || null;

  try {
    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        ...(typeof param.args?.frameId === 'number' ? { frameIds: [param.args.frameId] } : {}),
      },
      args: [
        param.name,
        selector,
        compact(param.args?.ref) || null,
        safeCoordinates,
        state,
        operationDetail(param),
        intent,
      ],
      func: (
        name: string,
        selector: string | null,
        ref: string | null,
        coordinates: { x: number; y: number } | null,
        state: 'Running' | 'Done' | 'Failed',
        detail: string,
        intent: string | null,
      ) => {
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
          chrome_scroll: 'Scroll',
          chrome_click_element: 'Click',
          chrome_click_and_wait: 'Click and wait',
          chrome_fill_or_select: 'Type or select',
          chrome_get_interactive_elements: 'Search elements',
          chrome_request_element_selection: 'Select scope',
          chrome_wait: 'Wait',
          chrome_extract: 'Extract data',
          chrome_navigate: 'Open page',
          get_windows_and_tabs: 'Read tabs',
          chrome_create_tab: 'Create tab',
          chrome_hover: 'Hover element',
          chrome_get_element_info: 'Query element',
          chrome_print_to_pdf: 'Print PDF',
          chrome_storage_get: 'Read page storage',
          chrome_storage_set: 'Write page storage',
          chrome_storage_delete: 'Delete page storage',
          search_tabs_content: 'Search content',
          chrome_screenshot: 'Screenshot',
          chrome_close_tabs: 'Close tabs',
          chrome_switch_tab: 'Switch tab',
          chrome_get_web_content: 'Read page',
          chrome_keyboard: 'Keyboard input',
          chrome_upload_file: 'Upload file',
          chrome_read_page: 'Read page',
          chrome_get_page_text: 'Read body text',
          chrome_spa_fetch: 'SPA extract',
          chrome_network_capture: 'Network capture',
          chrome_network_capture_start: 'Start capture',
          chrome_network_capture_stop: 'Stop capture',
          chrome_network_debugger_start: 'Start capture',
          chrome_network_debugger_stop: 'Stop capture',
          chrome_network_request: 'Network request',
          chrome_history: 'Search history',
          chrome_bookmark_search: 'Search bookmarks',
          chrome_bookmark_add: 'Add bookmark',
          chrome_bookmark_delete: 'Delete bookmark',
          chrome_handle_dialog: 'Handle dialog',
          chrome_handle_download: 'Handle download',
          chrome_computer: 'Simulate action',
          chrome_post_to_x: 'Post to X',
          chrome_javascript: 'Run script',
          chrome_paste_text: 'Synthesize paste',
          chrome_console: 'Read console',
          chrome_userscript: 'Manage userscripts',
          performance_start_trace: 'Start performance trace',
          performance_stop_trace: 'Stop performance trace',
          performance_analyze_insight: 'Analyze performance',
          chrome_gif_recorder: 'GIF recording',
          chrome_get_tab_url: 'Read URL',
          chrome_proxy_rotate: 'Rotate IP',
          chrome_get_scroll_state: 'Read scroll state',
          chrome_extract_review_summary: 'Extract review summary',
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
          const action =
            expanded === 'false' ? 'Expand' : expanded === 'true' ? 'Collapse' : 'Click';
          const separator = String(detail).indexOf('; ');
          const wait =
            name === 'chrome_click_and_wait' && separator >= 0
              ? String(detail).slice(separator)
              : '';
          detail = `${action}: ${elementName}${wait}`;
        } else if (
          elementName &&
          name === 'chrome_scroll' &&
          String(detail).startsWith('Scrolled to')
        ) {
          detail = `Scrolled to: ${elementName}`;
        } else if (elementName) {
          const targetLabels: Record<string, string> = {
            chrome_fill_or_select: 'Target',
            chrome_extract: 'Extract scope',
            chrome_get_page_text: 'Read body text',
            chrome_spa_fetch: 'SPA extract',
            chrome_screenshot: 'Screenshot',
            chrome_upload_file: 'Upload to',
          };
          if (targetLabels[name]) detail = `${targetLabels[name]}: ${elementName}`;
        }
        status.textContent = `${state}: ${actionLabels[name] || String(name).replace(/^chrome_/, '')}${detail ? `\n${detail}` : ''}${intent ? `\nIntent: ${intent}` : ''}`;

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
        (window as any)[key] = setTimeout(
          () => {
            status?.remove();
            highlight?.remove();
          },
          state === 'Running' ? 120_000 : 1_800,
        );
      },
    });
  } catch {
    // Status rendering must never turn a successful tool call into a failure.
  }
}

async function checkExpectedUrl(param: ToolCallParam): Promise<string | null> {
  const expectedUrl = String(param.args?.expectedUrl || '');
  if (!expectedUrl) return null;
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
export const handleCallTool = async (
  param: ToolCallParam,
  signal?: AbortSignal,
  reportProgress?: ToolProgressReporter,
) => {
  const tool = toolsMap.get(param.name);
  if (!tool) {
    return createErrorResponse(`Tool ${param.name} not found`);
  }

  let pausedTemporaryTabId: number | null = null;
  const isBackgroundOnlyTool = param.name === 'chrome_error_logs';
  try {
    if (signal?.aborted) return createErrorResponse('Tool call cancelled');
    const urlError = await checkExpectedUrl(param);
    if (urlError) return createErrorResponse(urlError);
    const args = { ...(param.args || {}) };
    if (args.background === undefined && param.name !== 'chrome_spa_fetch') {
      const { backgroundOperations = true } =
        await chrome.storage.local.get('backgroundOperations');
      args.background = backgroundOperations;
    }
    if (!(param.name === 'chrome_spa_fetch' && args.url && args.tabId === undefined)) {
      const targetTabId =
        typeof args.tabId === 'number'
          ? args.tabId
          : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
      if (typeof targetTabId === 'number' && (await pauseSpaFetchTabCleanup(targetTabId))) {
        pausedTemporaryTabId = targetTabId;
      }
    }
    if (!isBackgroundOnlyTool) await showOperation(param, 'Running');
    const actionPolicy = resolveActionPolicy(param.name, args);
    const result = await runWithActionPolicy<ToolResult>(actionPolicy, signal, () =>
      reportProgress ? tool.execute(args, signal, reportProgress) : tool.execute(args, signal),
    );
    if (!isBackgroundOnlyTool) void showOperation(param, result.isError ? 'Failed' : 'Done');
    return result;
  } catch (error) {
    if (!isBackgroundOnlyTool) void showOperation(param, 'Failed');
    console.error(`Tool execution failed for ${param.name}:`, error);
    return createErrorResponse(
      error instanceof Error ? error.message : ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
    );
  } finally {
    if (pausedTemporaryTabId !== null) {
      await scheduleSpaFetchTabCleanup(pausedTemporaryTabId).catch(() => undefined);
    }
  }
};
