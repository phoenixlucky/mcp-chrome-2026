import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import nativeMessagingHostInstance from '../native-messaging-host';
import { NativeMessageType, TOOL_NAMES, TOOL_SCHEMAS } from '@ethanwilkins/chrome-mcp-shared-2026';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';

interface ToolActivity {
  requestId: string;
  name: string;
  tabId?: number;
  startedAt: string;
  queueMs?: number;
  executionStartedAt?: string;
  elapsedMs?: number;
  outcome: 'running' | 'success' | 'error' | 'cancelled';
  error?: string;
}
const recentToolCalls: ToolActivity[] = [];
export const getRecentToolCalls = (): ToolActivity[] => recentToolCalls.slice(-20).reverse();
const WRITE_TOOL =
  /(?:navigate|click|scroll|fill|keyboard|key|dialog|computer|upload|paste|proxy_rotate|locate_element|select_all_items)/;
// A native browser dialog can block the helper call used to resolve the active tab.
// Let the dialog tool resolve its own tab instead of adding a second request that
// is guaranteed to time out while beforeunload is visible.
const SELF_RESOLVING_WRITE_TOOLS = new Set([
  TOOL_NAMES.BROWSER.HANDLE_DIALOG,
  TOOL_NAMES.BROWSER.POST_TO_X,
]);
// A call may be issued while another tab is active (side panels, devtools,
// file:// tabs, etc.). Keep single-tab inspection/interaction tools attached
// to the tab used by the previous browser operation when tabId is omitted.
const RECENT_TAB_DEFAULT_TOOLS = new Set([
  'chrome_javascript',
  'chrome_extract',
  'chrome_get_web_content',
  'chrome_get_page_text',
  'chrome_read_page',
  'chrome_get_interactive_elements',
  'chrome_console',
  'chrome_screenshot',
  'chrome_scroll',
  'chrome_get_scroll_state',
  'chrome_wait',
  'chrome_keyboard',
  'chrome_paste_text',
  'chrome_paste_image',
  'chrome_get_form_value',
  'chrome_computer',
  'chrome_click_element',
  'chrome_fill_or_select',
  'chrome_upload_file',
]);
const LONG_TOOL =
  /(?:performance|trace|record|download|upload|proxy_diagnostics|collect_virtual_list|select_all_items)/;
const tabQueues = new Map<string, Promise<void>>();
const MIN_TOOL_TRANSPORT_TIMEOUT_MS = 20_000;
type ToolProgressReporter = (progress: Record<string, unknown>) => void | Promise<void>;

async function listDynamicFlowTools(): Promise<Tool[]> {
  try {
    const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      {},
      'rr_list_published_flows',
      20000,
    );
    if (response && response.status === 'success' && Array.isArray(response.items)) {
      const tools: Tool[] = [];
      for (const item of response.items) {
        const name = `flow.${item.slug}`;
        const description =
          (item.meta && item.meta.tool && item.meta.tool.description) ||
          item.description ||
          'Recorded flow';
        const properties: Record<string, any> = {};
        const required: string[] = [];
        for (const v of item.variables || []) {
          const desc = v.label || v.key;
          const typ = (v.type || 'string').toLowerCase();
          const prop: any = { description: desc };
          if (typ === 'boolean') prop.type = 'boolean';
          else if (typ === 'number') prop.type = 'number';
          else if (typ === 'enum') {
            prop.type = 'string';
            if (v.rules && Array.isArray(v.rules.enum)) prop.enum = v.rules.enum;
          } else if (typ === 'array') {
            // default array of strings; can extend with itemType later
            prop.type = 'array';
            prop.items = { type: 'string' };
          } else {
            prop.type = 'string';
          }
          if (v.default !== undefined) prop.default = v.default;
          if (v.rules && v.rules.required) required.push(v.key);
          properties[v.key] = prop;
        }
        // Run options
        properties['tabTarget'] = { type: 'string', enum: ['current', 'new'], default: 'current' };
        properties['refresh'] = { type: 'boolean', default: false };
        properties['captureNetwork'] = { type: 'boolean', default: false };
        properties['returnLogs'] = { type: 'boolean', default: false };
        properties['timeoutMs'] = { type: 'number', minimum: 0 };
        const tool: Tool = {
          name,
          description,
          inputSchema: { type: 'object', properties, required },
        };
        tools.push(tool);
      }
      return tools;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export const setupTools = (server: Server) => {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const dynamicTools = await listDynamicFlowTools();
    return { tools: [...TOOL_SCHEMAS, ...dynamicTools] };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const progressToken = extra._meta?.progressToken;
    let lastProgress = -1;
    const reportProgress: ToolProgressReporter | undefined =
      progressToken === undefined
        ? undefined
        : (progress) =>
            (() => {
              const candidate =
                typeof progress.completed === 'number' && Number.isFinite(progress.completed)
                  ? Math.max(0, Math.floor(progress.completed))
                  : 0;
              const nextProgress = Math.max(lastProgress + 1, candidate);
              lastProgress = nextProgress;
              const total =
                typeof progress.total === 'number' &&
                Number.isFinite(progress.total) &&
                progress.total >= nextProgress
                  ? progress.total
                  : undefined;
              return extra.sendNotification({
                method: 'notifications/progress',
                params: {
                  progressToken,
                  progress: nextProgress,
                  ...(total === undefined ? {} : { total }),
                  message: JSON.stringify(progress),
                },
              });
            })();

    return handleToolCall(
      request.params.name,
      request.params.arguments || {},
      extra.signal,
      reportProgress,
    );
  });
};

function timeoutFor(name: string, args: any): number {
  const ceiling = LONG_TOOL.test(name) ? 120_000 : 60_000;
  const requested = Number(args.timeoutMs ?? args.timeout);
  return Number.isFinite(requested)
    ? Math.min(Math.max(requested, MIN_TOOL_TRANSPORT_TIMEOUT_MS), ceiling)
    : ceiling;
}

function serialByTab<T>(
  name: string,
  args: any,
  task: () => Promise<T>,
  onStart?: () => void,
): Promise<T> {
  if (args.newWindow || (!WRITE_TOOL.test(name) && !name.startsWith('flow.'))) {
    onStart?.();
    return task();
  }
  const key = `tab:${typeof args.tabId === 'number' ? args.tabId : 'active'}`;
  const previous = tabQueues.get(key) || Promise.resolve();
  const result = previous
    .catch(() => undefined)
    .then(() => {
      onStart?.();
      return task();
    });
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  tabQueues.set(key, tail);
  void tail.finally(() => {
    if (tabQueues.get(key) === tail) tabQueues.delete(key);
  });
  return result;
}

async function resolveWriteTab(args: any, signal?: AbortSignal): Promise<any> {
  if (typeof args.tabId === 'number' || args.newWindow) return args;
  const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
    { name: 'chrome_get_tab_url', args: { windowId: args.windowId } },
    NativeMessageType.CALL_TOOL,
    5_000,
    signal,
  );
  const text = response?.data?.content?.[0]?.text;
  const tabId = typeof text === 'string' ? JSON.parse(text).tabId : undefined;
  if (typeof tabId !== 'number') throw new Error('Could not resolve the active tab before write');
  return { ...args, tabId };
}

function getRecentTargetTabId(excludeRequestId: string): number | undefined {
  for (let i = recentToolCalls.length - 1; i >= 0; i--) {
    const call = recentToolCalls[i];
    if (call.requestId === excludeRequestId) continue;
    if (typeof call.tabId === 'number' && call.outcome !== 'cancelled') return call.tabId;
  }
  return undefined;
}

async function resolveRecentOrActiveTab(
  args: any,
  signal: AbortSignal | undefined,
  excludeRequestId: string,
): Promise<any> {
  if (typeof args.tabId === 'number' || args.newWindow || Array.isArray(args.tabIds)) return args;

  // A URL-backed web fetch resolves its own URL in the extension. Injecting
  // the most recently used tab here changes the meaning of the request and
  // can point it at a tab that has already been closed.
  if (typeof args.url === 'string' && args.url.trim().length > 0) return args;

  const recentTabId = getRecentTargetTabId(excludeRequestId);
  if (typeof recentTabId === 'number') {
    try {
      const recentTab = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
        { name: 'chrome_get_tab_url', args: { tabId: recentTabId } },
        NativeMessageType.CALL_TOOL,
        5_000,
        signal,
      );
      if (recentTab?.status === 'success' && recentTab.data?.isError !== true) {
        return { ...args, tabId: recentTabId };
      }
    } catch {
      // Fall back to the current active tab when the cached tab disappeared.
    }
  }

  const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
    { name: 'chrome_get_tab_url', args: { windowId: args.windowId } },
    NativeMessageType.CALL_TOOL,
    5_000,
    signal,
  );
  const text = response?.data?.content?.[0]?.text;
  const tabId = typeof text === 'string' ? JSON.parse(text).tabId : undefined;
  if (typeof tabId !== 'number') throw new Error('Could not resolve the target tab');
  return { ...args, tabId };
}

const handleToolCall = async (
  name: string,
  args: any,
  signal?: AbortSignal,
  reportProgress?: ToolProgressReporter,
): Promise<CallToolResult> => {
  const activity: ToolActivity = {
    requestId: randomUUID(),
    name,
    startedAt: new Date().toISOString(),
    outcome: 'running',
  };
  recentToolCalls.push(activity);
  if (recentToolCalls.length > 100) recentToolCalls.shift();
  try {
    if (RECENT_TAB_DEFAULT_TOOLS.has(name))
      args = await resolveRecentOrActiveTab(args, signal, activity.requestId);
    if (WRITE_TOOL.test(name) && !name.startsWith('flow.') && !SELF_RESOLVING_WRITE_TOOLS.has(name))
      args = await resolveWriteTab(args, signal);
    activity.tabId = args.tabId;
    // If calling a dynamic flow tool (name starts with flow.), proxy to common flow-run tool
    if (name && name.startsWith('flow.')) {
      // We need to resolve flow by slug to ID
      try {
        const resp = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
          {},
          'rr_list_published_flows',
          20000,
        );
        const items = (resp && resp.items) || [];
        const slug = name.slice('flow.'.length);
        const match = items.find((it: any) => it.slug === slug);
        if (!match) throw new Error(`Flow not found for tool ${name}`);
        const flowArgs = { flowId: match.id, args };
        const queuedAt = Date.now();
        const proxyRes = await serialByTab(
          name,
          args,
          () =>
            nativeMessagingHostInstance.sendRequestToExtensionAndWait(
              flowArgs,
              'rr_run_flow',
              timeoutFor('flow.run', args),
              signal,
              reportProgress,
            ),
          () => {
            activity.queueMs = Date.now() - queuedAt;
            activity.executionStartedAt = new Date().toISOString();
          },
        );
        if (proxyRes.status === 'success') {
          activity.outcome = 'success';
          return proxyRes.data;
        }
        activity.outcome = 'error';
        activity.error = proxyRes.error;
        return {
          content: [{ type: 'text', text: `Error calling dynamic flow tool: ${proxyRes.error}` }],
          isError: true,
        };
      } catch (err: any) {
        activity.outcome = 'error';
        activity.error = err?.message || String(err);
        return {
          content: [
            {
              type: 'text',
              text: `Error resolving dynamic flow tool: ${err?.message || String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
    // 发送请求到Chrome扩展并等待响应
    const queuedAt = Date.now();
    const response = await serialByTab(
      name,
      args,
      () =>
        nativeMessagingHostInstance.sendRequestToExtensionAndWait(
          { name, args },
          NativeMessageType.CALL_TOOL,
          timeoutFor(name, args),
          signal,
          reportProgress,
        ),
      () => {
        activity.queueMs = Date.now() - queuedAt;
        activity.executionStartedAt = new Date().toISOString();
      },
    );
    if (response.status === 'success') {
      activity.outcome = 'success';
      return response.data;
    } else {
      activity.outcome = 'error';
      activity.error = response.error;
      return {
        content: [
          {
            type: 'text',
            text: `Error calling tool: ${response.error}`,
          },
        ],
        isError: true,
      };
    }
  } catch (error: any) {
    activity.outcome = error.message === 'Request cancelled' ? 'cancelled' : 'error';
    activity.error = error.message;
    return {
      content: [
        {
          type: 'text',
          text: `Error calling tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  } finally {
    activity.elapsedMs = Date.now() - new Date(activity.startedAt).getTime();
  }
};
