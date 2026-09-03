import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import nativeMessagingHostInstance from '../native-messaging-host';
import {
  NativeMessageType,
  NativeProtocolError,
  TOOL_NAMES,
  TOOL_SCHEMAS,
} from '@ethanwilkins/chrome-mcp-shared-2026';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import type { RequestStageTimings } from '../observability.js';
import { browserProfileManager } from '../browser-profile-manager.js';
import {
  checkToolAccess,
  filterToolsByPermission,
  getToolPermissionPolicy,
} from './permission-policy.js';

interface ToolActivity {
  requestId: string;
  traceId: string;
  name: string;
  profileId?: string;
  tabId?: number;
  startedAt: string;
  queueMs?: number;
  executionStartedAt?: string;
  elapsedMs?: number;
  timings?: RequestStageTimings;
  outcome: 'running' | 'success' | 'error' | 'cancelled';
  error?: string;
}
const recentToolCalls: ToolActivity[] = [];
let lastToolTimings: RequestStageTimings | null = null;
export const getRecentToolCalls = (): ToolActivity[] => recentToolCalls.slice(-20).reverse();
export const getToolObservabilityStats = (): { lastTimings: RequestStageTimings | null } => ({
  lastTimings: lastToolTimings,
});
const WRITE_TOOL =
  /(?:navigate|click|scroll|fill|keyboard|key|dialog|computer|upload|paste|proxy_rotate|locate_element|select_all_items|hover|storage_set|storage_delete)/;
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
  'chrome_hover',
  'chrome_get_element_info',
  'chrome_print_to_pdf',
  'chrome_storage_get',
  'chrome_storage_set',
  'chrome_storage_delete',
]);
const LONG_TOOL =
  /(?:performance|trace|record|download|upload|proxy_diagnostics|collect_virtual_list|select_all_items)/;
const tabQueues = new Map<string, Promise<void>>();
const MIN_TOOL_TRANSPORT_TIMEOUT_MS = 20_000;
const TOOL_DEADLINE_META_KEY = 'chrome-mcp/deadlineAt';
const MAX_CONCURRENT_TOOL_CALLS = Math.max(
  1,
  Number.parseInt(process.env.CHROME_MCP_MAX_CONCURRENT_TOOLS || '8', 10) || 8,
);
const MAX_QUEUED_TOOL_CALLS = Math.max(
  0,
  Number.parseInt(process.env.CHROME_MCP_MAX_QUEUED_TOOLS || '64', 10) || 64,
);
let activeToolCallCount = 0;
type ToolQueueKind = 'read' | 'write';
interface QueuedToolCall {
  signal?: AbortSignal;
  profileId: string;
  kind: ToolQueueKind;
  enqueuedAt: number;
  deadlineAt?: number;
  timeoutId?: ReturnType<typeof setTimeout>;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  onAbort: () => void;
}
const queuedToolCalls: Record<ToolQueueKind, QueuedToolCall[]> = { read: [], write: [] };
const activeByProfile = new Map<string, number>();
let queueWaitTotalMs = 0;
let queueWaitSamples = 0;
let queueRejectCount = 0;
let queueTimeoutCount = 0;
let queueCancelCount = 0;
let lastAdmissionKind: ToolQueueKind = 'write';
type ToolProgressReporter = (progress: Record<string, unknown>) => void | Promise<void>;

function queuedToolCount(): number {
  return queuedToolCalls.read.length + queuedToolCalls.write.length;
}

function addActive(profileId: string): void {
  activeToolCallCount += 1;
  activeByProfile.set(profileId, (activeByProfile.get(profileId) || 0) + 1);
}

function removeActive(profileId: string): void {
  activeToolCallCount = Math.max(0, activeToolCallCount - 1);
  const next = Math.max(0, (activeByProfile.get(profileId) || 1) - 1);
  if (next) activeByProfile.set(profileId, next);
  else activeByProfile.delete(profileId);
}

function nextQueuedTool(): QueuedToolCall | undefined {
  const preferred = lastAdmissionKind === 'write' ? 'read' : 'write';
  const first = queuedToolCalls[preferred].length
    ? queuedToolCalls[preferred]
    : queuedToolCalls[preferred === 'read' ? 'write' : 'read'];
  const waiter = first.shift();
  if (waiter) lastAdmissionKind = waiter.kind;
  return waiter;
}

function drainToolCallQueue(): void {
  while (activeToolCallCount < MAX_CONCURRENT_TOOL_CALLS && queuedToolCount()) {
    const waiter = nextQueuedTool();
    if (!waiter) return;
    if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
    waiter.signal?.removeEventListener('abort', waiter.onAbort);
    if (waiter.signal?.aborted) {
      queueCancelCount += 1;
      waiter.reject(new Error('Request cancelled'));
      continue;
    }
    if (waiter.deadlineAt !== undefined && waiter.deadlineAt <= Date.now()) {
      waiter.reject(
        new NativeProtocolError('DEADLINE_EXCEEDED', 'Request deadline exceeded in queue'),
      );
      continue;
    }

    queueWaitTotalMs += Math.max(0, Date.now() - waiter.enqueuedAt);
    queueWaitSamples += 1;
    addActive(waiter.profileId);
    let released = false;
    waiter.resolve(() => {
      if (released) return;
      released = true;
      removeActive(waiter.profileId);
      drainToolCallQueue();
    });
  }
}

export function acquireToolCallSlot(
  signal: AbortSignal | undefined,
  kind: ToolQueueKind,
  profileId: string,
  deadlineAt?: number,
): Promise<() => void> {
  if (signal?.aborted) return Promise.reject(new Error('Request cancelled'));
  if (activeToolCallCount < MAX_CONCURRENT_TOOL_CALLS) {
    addActive(profileId);
    let released = false;
    return Promise.resolve(() => {
      if (released) return;
      released = true;
      removeActive(profileId);
      drainToolCallQueue();
    });
  }
  if (queuedToolCount() >= MAX_QUEUED_TOOL_CALLS) {
    queueRejectCount += 1;
    return Promise.reject(
      new NativeProtocolError('QUEUE_FULL', 'Too many browser tool calls are queued'),
    );
  }

  return new Promise((resolve, reject) => {
    const waiter: QueuedToolCall = {
      signal,
      profileId,
      kind,
      enqueuedAt: Date.now(),
      deadlineAt,
      resolve,
      reject,
      onAbort: () => {
        queueCancelCount += 1;
        if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
        const index = queuedToolCalls[kind].indexOf(waiter);
        if (index >= 0) queuedToolCalls[kind].splice(index, 1);
        reject(new Error('Request cancelled'));
      },
    };
    if (deadlineAt !== undefined) {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) {
        reject(new NativeProtocolError('DEADLINE_EXCEEDED', 'Request deadline exceeded in queue'));
        return;
      }
      waiter.timeoutId = setTimeout(() => {
        const index = queuedToolCalls[kind].indexOf(waiter);
        if (index < 0) return;
        queuedToolCalls[kind].splice(index, 1);
        signal?.removeEventListener('abort', waiter.onAbort);
        queueTimeoutCount += 1;
        reject(new NativeProtocolError('DEADLINE_EXCEEDED', 'Request deadline exceeded in queue'));
      }, remaining);
    }
    signal?.addEventListener('abort', waiter.onAbort, { once: true });
    queuedToolCalls[kind].push(waiter);
  });
}

export function getToolAdmissionStats(): {
  active: number;
  queued: number;
  maxActive: number;
  maxQueued: number;
  averageQueueMs: number;
  rejected: number;
  timedOut: number;
  cancelled: number;
  byProfile: Record<string, { active: number; queued: number }>;
} {
  const byProfile: Record<string, { active: number; queued: number }> = {};
  for (const [profileId, active] of activeByProfile) byProfile[profileId] = { active, queued: 0 };
  for (const kind of ['read', 'write'] as const) {
    for (const waiter of queuedToolCalls[kind]) {
      byProfile[waiter.profileId] ||= { active: 0, queued: 0 };
      byProfile[waiter.profileId].queued += 1;
    }
  }
  return {
    active: activeToolCallCount,
    queued: queuedToolCount(),
    maxActive: MAX_CONCURRENT_TOOL_CALLS,
    maxQueued: MAX_QUEUED_TOOL_CALLS,
    averageQueueMs: queueWaitSamples ? Math.round(queueWaitTotalMs / queueWaitSamples) : 0,
    rejected: queueRejectCount,
    timedOut: queueTimeoutCount,
    cancelled: queueCancelCount,
    byProfile,
  };
}

export function getToolDeadlineAt(meta: unknown): number | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const value = (meta as Record<string, unknown>)[TOOL_DEADLINE_META_KEY];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function listDynamicFlowTools(): Promise<Tool[]> {
  if (!nativeMessagingHostInstance.isExtensionConnected()) return [];

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
        properties['profileId'] = {
          type: 'string',
          description: 'Optional isolated browser Profile ID; omit it to control current Chrome.',
        };
        properties['actionPolicy'] = {
          type: 'string',
          enum: ['fast', 'balanced', 'human'],
          default: 'balanced',
          description: 'Unified action pacing: fast, balanced (default), or human.',
        };
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
    const policy = getToolPermissionPolicy();
    return {
      tools: filterToolsByPermission([...TOOL_SCHEMAS, ...dynamicTools], policy),
    };
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
      getToolDeadlineAt(extra._meta),
    );
  });
};

function timeoutFor(name: string, args: any, deadlineAt?: number): number {
  const ceiling = LONG_TOOL.test(name) ? 120_000 : 60_000;
  const requested = Number(args.timeoutMs ?? args.timeout);
  const timeout = Number.isFinite(requested)
    ? Math.min(Math.max(requested, MIN_TOOL_TRANSPORT_TIMEOUT_MS), ceiling)
    : ceiling;
  if (typeof deadlineAt !== 'number') return timeout;
  const remaining = Math.floor(deadlineAt - Date.now());
  if (remaining <= 0) throw new Error('Request deadline exceeded');
  return Math.max(250, Math.min(timeout, remaining));
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
  const profileId =
    typeof args.profileId === 'string' && args.profileId.trim() ? args.profileId.trim() : 'default';
  const key = `${profileId}:tab:${typeof args.tabId === 'number' ? args.tabId : 'active'}`;
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

  const recentTabId =
    typeof args.windowId === 'number' ? undefined : getRecentTargetTabId(excludeRequestId);
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

async function handleProfileTool(args: Record<string, unknown>): Promise<CallToolResult> {
  const action = typeof args.action === 'string' ? args.action : '';
  const profileId = typeof args.profileId === 'string' ? args.profileId.trim() : '';
  let value: unknown;

  switch (action) {
    case 'list':
      value = await browserProfileManager.list();
      break;
    case 'status': {
      const profiles = await browserProfileManager.list();
      value = profileId ? profiles.filter((profile) => profile.id === profileId) : profiles;
      break;
    }
    case 'diagnostics':
      if (!profileId) throw new Error('profileId is required for diagnostics');
      value = await browserProfileManager.diagnostics(profileId);
      break;
    case 'create':
      value = await browserProfileManager.create({
        id: profileId || undefined,
        name: String(args.name || ''),
        userDataDir: typeof args.userDataDir === 'string' ? args.userDataDir : undefined,
        chromePath: typeof args.chromePath === 'string' ? args.chromePath : undefined,
        extensionPath: typeof args.extensionPath === 'string' ? args.extensionPath : undefined,
        launchArgs: Array.isArray(args.launchArgs) ? args.launchArgs : undefined,
      });
      break;
    case 'launch':
      if (!profileId) throw new Error('profileId is required for launch');
      value = await browserProfileManager.launch(profileId);
      break;
    case 'stop':
      if (!profileId) throw new Error('profileId is required for stop');
      value = await browserProfileManager.stop(profileId);
      break;
    case 'delete':
      if (!profileId) throw new Error('profileId is required for delete');
      value = await browserProfileManager.delete(profileId);
      break;
    default:
      throw new Error(
        'action must be one of: list, create, launch, stop, delete, status, diagnostics',
      );
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    isError: false,
  };
}

async function handleBatchTool(
  args: Record<string, unknown>,
  signal?: AbortSignal,
  reportProgress?: ToolProgressReporter,
  deadlineAt?: number,
): Promise<CallToolResult> {
  if (!Array.isArray(args.calls) || args.calls.length > 50)
    throw new Error('calls must be an array with at most 50 items');
  const inheritedProfileId = typeof args.profileId === 'string' ? args.profileId.trim() : '';
  const stopOnError = args.stopOnError !== false;
  const results: Array<{ name: string; result: CallToolResult }> = [];
  for (const item of args.calls) {
    if (!item || typeof item !== 'object' || typeof (item as any).name !== 'string') {
      throw new Error('Each batch call requires a tool name');
    }
    const call = item as { name: string; arguments?: unknown };
    if (call.name === TOOL_NAMES.BROWSER.BATCH)
      throw new Error('Nested chrome_batch calls are not supported');
    const callArgs =
      call.arguments && typeof call.arguments === 'object'
        ? { ...(call.arguments as Record<string, unknown>) }
        : {};
    if (inheritedProfileId && !callArgs.profileId) callArgs.profileId = inheritedProfileId;
    const result = await handleToolCall(call.name, callArgs, signal, reportProgress, deadlineAt);
    results.push({ name: call.name, result });
    if (result.isError && stopOnError) break;
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(results) }],
    isError: results.some((item) => item.result.isError),
  };
}

export const handleToolCall = async (
  name: string,
  args: any,
  signal?: AbortSignal,
  reportProgress?: ToolProgressReporter,
  deadlineAt?: number,
): Promise<CallToolResult> => {
  const activity: ToolActivity = {
    requestId: randomUUID(),
    traceId: randomUUID(),
    name,
    startedAt: new Date().toISOString(),
    outcome: 'running',
  };
  recentToolCalls.push(activity);
  if (recentToolCalls.length > 100) recentToolCalls.shift();
  let releaseToolCallSlot: (() => void) | null = null;
  const timings: RequestStageTimings = {
    stdio_wait: 0,
    http_process: 0,
    native_queue_wait: 0,
    native_roundtrip: 0,
    browser_execution: 0,
    total: 0,
  };
  activity.timings = timings;
  const admissionStartedAt = Date.now();
  try {
    const access = checkToolAccess(name);
    if (!access.allowed) {
      activity.outcome = 'error';
      activity.error = access.message;
      return {
        content: [{ type: 'text', text: access.message || 'Tool call not allowed.' }],
        isError: true,
      };
    }

    if (name === TOOL_NAMES.BROWSER.BATCH) {
      const response = await handleBatchTool(args, signal, reportProgress, deadlineAt);
      activity.outcome = response.isError ? 'error' : 'success';
      return response;
    }

    const profileId = typeof args.profileId === 'string' ? args.profileId.trim() : 'default';
    const queueKind: ToolQueueKind =
      WRITE_TOOL.test(name) || name.startsWith('flow.') ? 'write' : 'read';
    releaseToolCallSlot = await acquireToolCallSlot(signal, queueKind, profileId, deadlineAt);
    timings.native_queue_wait = Math.max(0, Date.now() - admissionStartedAt);

    if (name === TOOL_NAMES.BROWSER.PROFILE) {
      const response = await handleProfileTool(args);
      activity.outcome = 'success';
      return response;
    }

    if (profileId !== 'default') {
      const { profileId: _profileId, ...profileArgs } = args;
      activity.profileId = profileId;
      const response = await serialByTab(name, args, () =>
        browserProfileManager.callTool(profileId, name, profileArgs, signal),
      );
      activity.outcome = response.isError ? 'error' : 'success';
      return response;
    }

    if (RECENT_TAB_DEFAULT_TOOLS.has(name))
      args = await resolveRecentOrActiveTab(args, signal, activity.requestId);
    if (WRITE_TOOL.test(name) && !name.startsWith('flow.') && !SELF_RESOLVING_WRITE_TOOLS.has(name))
      args = await resolveWriteTab(args, signal);
    activity.tabId = args.tabId;
    // If calling a dynamic flow tool (name starts with flow.), proxy to common flow-run tool
    if (name && name.startsWith('flow.')) {
      // We need to resolve flow by slug to ID
      try {
        const nativeStartedAt = Date.now();
        const resp = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
          {},
          'rr_list_published_flows',
          20000,
          signal,
          undefined,
          activity.traceId,
        );
        timings.native_roundtrip += Math.max(0, Date.now() - nativeStartedAt);
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
            (async () => {
              const nativeStartedAt = Date.now();
              try {
                return await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
                  flowArgs,
                  'rr_run_flow',
                  timeoutFor('flow.run', args, deadlineAt),
                  signal,
                  reportProgress,
                  activity.traceId,
                );
              } finally {
                timings.native_roundtrip += Math.max(0, Date.now() - nativeStartedAt);
              }
            })(),
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
        (async () => {
          const nativeStartedAt = Date.now();
          try {
            return await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
              { name, args },
              NativeMessageType.CALL_TOOL,
              timeoutFor(name, args, deadlineAt),
              signal,
              reportProgress,
              activity.traceId,
            );
          } finally {
            timings.native_roundtrip += Math.max(0, Date.now() - nativeStartedAt);
          }
        })(),
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
    const code = error instanceof NativeProtocolError ? error.code : undefined;
    if (code === 'DEADLINE_EXCEEDED' || /deadline exceeded/i.test(error?.message || '')) {
      queueTimeoutCount += 1;
    }
    activity.outcome =
      code === 'CANCELED' || /cancel/i.test(error?.message || '') ? 'cancelled' : 'error';
    activity.error = code ? `${code}: ${error.message}` : error.message;
    return {
      content: [
        {
          type: 'text',
          text: `Error calling tool${code ? ` [${code}]` : ''}: ${error.message}`,
        },
      ],
      isError: true,
    };
  } finally {
    releaseToolCallSlot?.();
    activity.elapsedMs = Date.now() - new Date(activity.startedAt).getTime();
    timings.total = activity.elapsedMs;
    timings.browser_execution = Math.max(0, timings.native_roundtrip);
    timings.http_process = Math.max(
      0,
      timings.total - timings.native_queue_wait - timings.browser_execution,
    );
    lastToolTimings = { ...timings };
    nativeMessagingHostInstance.recordRequestTimings(activity.traceId, timings);
  }
};
