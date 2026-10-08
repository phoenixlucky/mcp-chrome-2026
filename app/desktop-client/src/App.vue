<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import AssetIcon from './components/AssetIcon.vue';

const PORT = 12306;
const STATUS_POLL_INTERVAL_MS = 3_000;
const ERROR_DIAGNOSTICS_POLL_INTERVAL_MS = 10_000;
const APP_VERSION = __APP_VERSION__;
const isTauri = Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

type BridgeResponse = {
  ok: boolean;
  status: number;
  data?: Record<string, any>;
  error?: string;
};

type RuntimeTask = {
  summary: {
    taskId: string;
    kind: 'mcp' | 'agent' | 'workflow';
    label: string;
    clientName?: string | null;
    sessionId?: string | null;
    toolName?: string | null;
    tabId?: number | null;
    profileId?: string | null;
    origin?: string | null;
    startedAt: string;
    updatedAt: string;
    elapsedMs: number;
    status:
      | 'running'
      | 'waiting'
      | 'paused'
      | 'cancelling'
      | 'success'
      | 'error'
      | 'cancelled'
      | 'unknown';
    cancelable: boolean;
    pausable: boolean;
    errorCategory?: string | null;
    errorMessage?: string | null;
  };
  events: Array<{
    type: string;
    at: string;
    status: RuntimeTask['summary']['status'];
    elapsedMs?: number;
    message?: string | null;
  }>;
};

type RuntimeResponse = {
  tasks: RuntimeTask[];
  activeCount: number;
};

type McpClient = {
  sessionId: string;
  clientInfo: { name: string; version: string } | null;
  transport: 'streamable-http' | 'sse' | 'stdio';
  endpoint?: '/mcp' | '/sse';
  remoteAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivityAt: string;
  activeRequests: number;
  requestCount: number;
  lastRequestLatencyMs: number | null;
  p95RequestLatencyMs: number | null;
  averageRequestLatencyMs: number | null;
  maxRequestLatencyMs: number | null;
  errorCount: number;
  lastError: string | null;
};

type McpRequest = {
  requestId: string;
  method: string;
  toolName: string | null;
  endpoint: '/mcp' | '/mcp-new' | '/sse' | null;
  transport: 'streamable-http' | 'sse' | 'stdio' | null;
  sessionId: string | null;
  jsonRpcId: string | number | null;
  clientInfo: { name: string; version: string } | null;
  remoteAddress: string | null;
  userAgent: string | null;
  startedAt: string;
  elapsedMs: number;
  status: 'running' | 'success' | 'error' | 'cancelled';
  cancelRequestedAt: string | null;
  error: string | null;
};

type StatelessMcpStatus = {
  endpoint: '/mcp-new';
  transport: 'streamable-http';
  activeRequests: number;
  requestCount: number;
  lastRequestAt: string | null;
  lastRequestLatencyMs: number | null;
  clientInfo: { name: string; version: string } | null;
  remoteAddress: string | null;
  userAgent: string | null;
  errorCount: number;
  requests: McpRequest[];
};

type DesktopErrorLog = {
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
};

type ErrorTerminal = {
  terminalId: string;
  name: string;
  status: string;
  logs: DesktopErrorLog[];
  error?: string;
};

type ErrorDiagnostics = {
  generatedAt: string;
  terminals: ErrorTerminal[];
  errors: string[];
};

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  element_not_found: 'Element not found',
  element_not_actionable: 'Element not actionable',
  navigation_cancelled: 'Navigation cancelled',
  selector_multiple_matches: 'Selector matched multiple elements',
  coordinate_target_missing: 'No element at coordinates',
  tab_missing: 'Tab missing',
  restricted_page: 'Restricted page cannot be injected',
  message_channel_closed: 'Message channel closed',
  proxy_error: 'Residential proxy error',
  other: 'Other errors',
};

const state = reactive({
  phase: 'checking' as 'checking' | 'running' | 'waiting' | 'stopped' | 'offline',
  message: 'Starting the local service…',
  lastUpdated: '',
  busy: false,
  data: null as Record<string, any> | null,
});

let timer: number | undefined;
let errorTimer: number | undefined;
let removeTrayListener: UnlistenFn | undefined;
const errorDiagnostics = ref<ErrorDiagnostics | null>(null);
const runtime = ref<RuntimeResponse | null>(null);
const runtimeFilter = ref<'all' | RuntimeTask['summary']['status']>('all');
const selectedRuntimeTaskId = ref<string | null>(null);
const runtimeActionTaskId = ref<string | null>(null);
const activeNav = ref('overview');
const errorDiagnosticsMessage = ref('Error logs not loaded yet');
const errorTerminalFilter = ref('all');
const errorCategoryFilter = ref<string | null>(null);
const isExportingErrorDiagnostics = ref(false);
const isClearingErrorDiagnostics = ref(false);
const isRefreshingErrorDiagnostics = ref(false);
let errorDiagnosticsRequestVersion = 0;

const errorTerminalOptions = computed(() => errorDiagnostics.value?.terminals ?? []);
const selectedTerminalLogs = computed(() => {
  const terminals = errorDiagnostics.value?.terminals ?? [];
  return terminals
    .filter(
      (terminal) =>
        errorTerminalFilter.value === 'all' || terminal.terminalId === errorTerminalFilter.value,
    )
    .flatMap((terminal) =>
      terminal.logs.map((log) => ({
        ...log,
        terminalId: terminal.terminalId,
        terminalName: terminal.name,
      })),
    );
});
const visibleErrorLogs = computed(() =>
  selectedTerminalLogs.value.filter(
    (log) =>
      !errorCategoryFilter.value || classifyErrorMessage(log.message) === errorCategoryFilter.value,
  ),
);
const errorCategoryRows = computed(() => {
  const counts: Record<string, number> = {};
  for (const log of selectedTerminalLogs.value) {
    const category = classifyErrorMessage(log.message);
    counts[category] = (counts[category] || 0) + 1;
  }
  return Object.entries(ERROR_CATEGORY_LABELS).map(([category, label]) => ({
    category,
    label,
    count: counts[category] || 0,
  }));
});
const errorTotal = computed(() => visibleErrorLogs.value.length);
const selectedErrorCategoryLabel = computed(() =>
  errorCategoryFilter.value ? ERROR_CATEGORY_LABELS[errorCategoryFilter.value] : '',
);

const runtimeTasks = computed(() => runtime.value?.tasks ?? []);
const visibleRuntimeTasks = computed(() =>
  runtimeTasks.value.filter(
    (task) => runtimeFilter.value === 'all' || task.summary.status === runtimeFilter.value,
  ),
);
const selectedRuntimeTask = computed(
  () =>
    runtimeTasks.value.find((task) => task.summary.taskId === selectedRuntimeTaskId.value) ??
    visibleRuntimeTasks.value[0] ??
    null,
);
const runtimeActiveCount = computed(() => runtime.value?.activeCount ?? 0);

function classifyErrorMessage(message: string) {
  if (/proxy|tunnel/i.test(message)) return 'proxy_error';
  if (/matched multiple elements/i.test(message)) return 'selector_multiple_matches';
  if (/not actionable/i.test(message)) return 'element_not_actionable';
  if (/No element found at the specified coordinates/i.test(message))
    return 'coordinate_target_missing';
  if (/Tool call cancelled|navigation.*cancel/i.test(message)) return 'navigation_cancelled';
  if (/not script-injectable|restricted page|cannot inject|chrome:\/\//i.test(message))
    return 'restricted_page';
  if (/No tab with id|Tab .* not found|tab .* closed/i.test(message)) return 'tab_missing';
  if (/message channel closed/i.test(message)) return 'message_channel_closed';
  if (/Element with selector .* not found|element .* not found/i.test(message))
    return 'element_not_found';
  return 'other';
}

const phaseMeta = computed(() => {
  switch (state.phase) {
    case 'running':
      return { label: 'Running', tone: 'success' };
    case 'waiting':
      return { label: 'Waiting for Chrome', tone: 'warning' };
    case 'stopped':
      return { label: 'Service stopped', tone: 'warning' };
    case 'offline':
      return { label: 'Waiting to connect', tone: 'danger' };
    default:
      return { label: 'Checking', tone: 'info' };
  }
});

const serverRunning = computed(() => Boolean(state.data?.server?.serviceRunning));
const extensionConnected = computed(() => Boolean(state.data?.extension?.connected));
const nativeConnected = computed(() => Boolean(state.data?.nativeHost?.connected));
const sessions = computed(() => state.data?.mcp?.activeSessions ?? '—');
const toolCount = computed(() => state.data?.tools?.count ?? '—');
// V2 is currently the only supported Native/Extension protocol. Keep the
// fallback for an already-running bridge built before /status exposed the
// field, so the UI never renders an unknown protocol as "V—".
const protocolVersion = computed(() => state.data?.server?.protocolVersion ?? 2);
const clients = computed<McpClient[]>(() => {
  const value = state.data?.mcp?.clients;
  return Array.isArray(value) ? (value as McpClient[]) : [];
});
const statelessMcp = computed<StatelessMcpStatus | null>(() => {
  const value = state.data?.mcp?.stateless as Partial<StatelessMcpStatus> | undefined;
  return value?.endpoint === '/mcp-new' ? (value as StatelessMcpStatus) : null;
});
const activeMcpRequests = computed<McpRequest[]>(() => {
  const value = state.data?.mcp?.requests;
  return Array.isArray(value) ? (value as McpRequest[]) : [];
});
const recentMcpRequests = computed<McpRequest[]>(() => {
  const value = state.data?.mcp?.recentRequests;
  return Array.isArray(value) ? (value as McpRequest[]) : [];
});
const showClients = ref(false);
const showRecentMcpRequests = ref(true);
const cancellingRequestId = ref<string | null>(null);

watch(showClients, (open) => {
  document.body.classList.toggle('modal-open', open);
});

function statusFor(value: boolean | undefined, waiting = false) {
  if (value) return 'success';
  return waiting ? 'warning' : 'danger';
}

function formatActivity(value: unknown) {
  if (!value) return 'No activity';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function clientName(client: McpClient) {
  return client.clientInfo?.name || 'Unknown client';
}

function clientVersion(client: McpClient) {
  return client.clientInfo?.version || 'Unknown version';
}

function clientInitial(client: McpClient) {
  return clientName(client).slice(0, 1).toUpperCase();
}

function transportLabel(client: McpClient) {
  if (client.transport === 'stdio') return 'STDIO';
  if (client.endpoint === '/sse' || client.transport === 'sse') return 'SSE (legacy MCP)';
  return 'Streamable HTTP (compatible)';
}

function requestTransportLabel(request: McpRequest) {
  if (request.transport === 'stdio') return 'STDIO';
  if (request.transport === 'sse' || request.endpoint === '/sse') return 'SSE';
  if (request.endpoint === '/mcp-new') return 'Streamable HTTP (preview)';
  return 'Streamable HTTP (compatible)';
}

function requestStatusLabel(status: McpRequest['status']) {
  if (status === 'success') return 'Success';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'error') return 'Failed';
  return 'Running';
}

function requestStatusClass(status: McpRequest['status']) {
  if (status === 'success') return 'request-status-success';
  if (status === 'cancelled') return 'request-status-cancelled';
  if (status === 'error') return 'request-status-error';
  return 'request-status-running';
}

function endpointLabel(client: McpClient) {
  const endpoint = client.endpoint || (client.transport === 'sse' ? '/sse' : '/mcp');
  if (client.transport === 'stdio') {
    return `mcp-chrome-stdio / EXE --stdio → http://127.0.0.1:${PORT}${endpoint}`;
  }
  return `http://127.0.0.1:${PORT}${endpoint}`;
}

function shortSessionId(sessionId: string) {
  return sessionId ? `…${sessionId.slice(-8)}` : '—';
}

function formatLatency(value: number | null | undefined) {
  if (typeof value !== 'number') return 'No requests';
  return value < 1 ? '<1 ms' : `${value} ms`;
}

function latencyTone(value: number | null | undefined) {
  if (typeof value !== 'number') return 'latency-muted';
  if (value <= 100) return 'latency-good';
  if (value <= 500) return 'latency-warning';
  return 'latency-danger';
}

function formatDuration(value: string | undefined) {
  if (!value) return '—';
  const elapsedMs = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsedMs)) return '—';
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'Less than 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

function formatElapsed(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function runtimeKindLabel(kind: RuntimeTask['summary']['kind']) {
  return kind === 'agent' ? 'Agent' : kind === 'workflow' ? 'Workflow' : 'MCP';
}

function runtimeStatusLabel(status: RuntimeTask['summary']['status']) {
  const labels: Record<RuntimeTask['summary']['status'], string> = {
    running: 'Running',
    waiting: 'Waiting for Chrome',
    paused: 'Paused',
    cancelling: 'Cancelling',
    success: 'Success',
    error: 'Failed',
    cancelled: 'Cancelled',
    unknown: 'Unknown status',
  };
  return labels[status];
}

function runtimeStatusTone(status: RuntimeTask['summary']['status']) {
  if (status === 'success') return 'tone-success';
  if (status === 'error' || status === 'unknown') return 'tone-danger';
  if (
    status === 'paused' ||
    status === 'waiting' ||
    status === 'cancelling' ||
    status === 'cancelled'
  )
    return 'tone-warning';
  return 'tone-info';
}

function runtimeElapsed(task: RuntimeTask) {
  if (['success', 'error', 'cancelled', 'unknown'].includes(task.summary.status))
    return formatElapsed(task.summary.elapsedMs);
  return formatElapsed(Math.max(0, Date.now() - new Date(task.summary.startedAt).getTime()));
}

function shortRequestId(requestId: string) {
  return requestId ? `…${requestId.slice(-8)}` : '—';
}

async function copyValue(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    state.message = 'Copied to clipboard';
  } catch {
    state.message = 'Copy failed, select the address manually';
  }
}

async function localRequest(path: string, method = 'GET'): Promise<BridgeResponse> {
  if (isTauri) {
    if (path === '/status') return invoke<BridgeResponse>('get_status');
    if (path === '/__chrome_mcp_bridge/error-diagnostics')
      return invoke<BridgeResponse>('get_error_diagnostics');
    if (path === '/status?probe=1') return invoke<BridgeResponse>('health_check');
    if (path === '/__chrome_mcp_bridge/runtime') return invoke<BridgeResponse>('get_runtime');
    if (path.startsWith('/__chrome_mcp_bridge/runtime/')) {
      const parts = path.split('/');
      return invoke<BridgeResponse>('control_runtime', {
        taskId: decodeURIComponent(parts[parts.length - 2] || ''),
        action: parts[parts.length - 1] || '',
      });
    }
    return invoke<BridgeResponse>('control_service', {
      action: path.endsWith('/start') ? 'start' : 'stop',
    });
  }

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
      method,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => undefined);
    return { ok: response.ok, status: response.status, data, error: data?.message };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function refreshRuntime() {
  const response = await localRequest('/__chrome_mcp_bridge/runtime');
  if (response.ok && response.data) {
    runtime.value = response.data as RuntimeResponse;
    if (!selectedRuntimeTask.value && visibleRuntimeTasks.value.length) {
      selectedRuntimeTaskId.value = visibleRuntimeTasks.value[0].summary.taskId;
    }
  } else if (response.status === 401 || response.status === 403) {
    state.message = response.error || 'Runtime control failed local authentication';
  }
}

async function controlRuntimeTask(
  task: RuntimeTask,
  action: 'cancel' | 'pause' | 'resume' | 'focus',
) {
  if (runtimeActionTaskId.value) return;
  runtimeActionTaskId.value = task.summary.taskId;
  try {
    const path = `/__chrome_mcp_bridge/runtime/${encodeURIComponent(task.summary.taskId)}/${action}`;
    const response = await localRequest(path, 'POST');
    state.message = response.ok
      ? action === 'focus'
        ? 'Browser tab focused'
        : `${runtimeStatusLabel((response.data?.status as RuntimeTask['summary']['status']) || task.summary.status)} · control sent`
      : response.error || 'Runtime operation failed';
    await refreshRuntime();
    await refresh();
  } finally {
    runtimeActionTaskId.value = null;
  }
}

async function refreshErrorDiagnostics(force = false) {
  if ((!force && isClearingErrorDiagnostics.value) || isRefreshingErrorDiagnostics.value) return;
  const requestVersion = ++errorDiagnosticsRequestVersion;
  isRefreshingErrorDiagnostics.value = true;
  try {
    const response = await localRequest('/__chrome_mcp_bridge/error-diagnostics');
    // A slower request started before clear/refresh must not overwrite the
    // newer view with stale diagnostics.
    if (requestVersion !== errorDiagnosticsRequestVersion) return;
    if (!response.ok || !response.data) {
      errorDiagnostics.value = null;
      errorDiagnosticsMessage.value = response.error || 'Error diagnostics service not connected';
      return;
    }
    errorDiagnostics.value = response.data as ErrorDiagnostics;
    errorDiagnosticsMessage.value = 'Error logs updated';
  } finally {
    if (requestVersion === errorDiagnosticsRequestVersion) {
      isRefreshingErrorDiagnostics.value = false;
    }
  }
}

function errorLogText() {
  return visibleErrorLogs.value
    .map(
      (log) =>
        `[${formatActivity(log.timestamp)}] [${log.terminalName}] ${log.type}: ${log.message}${log.stack ? `\n${log.stack}` : ''}`,
    )
    .join('\n\n');
}

async function exportErrorDiagnostics() {
  if (isExportingErrorDiagnostics.value) return;
  isExportingErrorDiagnostics.value = true;
  try {
    await refreshErrorDiagnostics();
    const payload = {
      exportedAt: new Date().toISOString(),
      terminalId: errorTerminalFilter.value,
      summary: {
        total: errorTotal.value,
        categories: Object.fromEntries(
          errorCategoryRows.value.map((row) => [row.category, row.count]),
        ),
      },
      logs: visibleErrorLogs.value,
    };
    const blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `chrome-mcp-error-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  } finally {
    isExportingErrorDiagnostics.value = false;
  }
}

function toggleErrorCategory(category: string) {
  errorCategoryFilter.value = errorCategoryFilter.value === category ? null : category;
}

async function clearErrorDiagnostics() {
  if (isClearingErrorDiagnostics.value) return;
  const targetLabel =
    errorTerminalFilter.value === 'all' ? 'all terminals' : 'the selected terminal';
  if (!window.confirm(`Clear error logs for ${targetLabel}? This cannot be undone.`)) return;

  isClearingErrorDiagnostics.value = true;
  // Invalidate an in-flight poll before sending the clear request. Its result
  // may finish later, but it can no longer repopulate the cleared view.
  ++errorDiagnosticsRequestVersion;
  isRefreshingErrorDiagnostics.value = false;
  try {
    const terminalId = errorTerminalFilter.value;
    const path =
      terminalId === 'all'
        ? '/__chrome_mcp_bridge/error-diagnostics/clear'
        : `/__chrome_mcp_bridge/error-diagnostics/clear?terminalId=${encodeURIComponent(terminalId)}`;
    const response = isTauri
      ? await invoke<BridgeResponse>('clear_error_diagnostics', { terminalId })
      : await localRequest(path, 'POST');
    if (!response.ok) {
      const errors = Array.isArray(response.data?.errors) ? response.data.errors.join('; ') : '';
      errorDiagnosticsMessage.value = response.error || errors || 'Failed to clear error logs';
      return;
    }
    errorCategoryFilter.value = null;
    if (errorDiagnostics.value) {
      errorDiagnostics.value = {
        ...errorDiagnostics.value,
        generatedAt: new Date().toISOString(),
        terminals: errorDiagnostics.value.terminals.map((terminal) =>
          terminalId === 'all' || terminal.terminalId === terminalId
            ? { ...terminal, logs: [], error: undefined }
            : terminal,
        ),
        errors: [],
      };
    }
    errorDiagnosticsMessage.value = 'Error logs cleared';
    await refreshErrorDiagnostics(true);
  } finally {
    isClearingErrorDiagnostics.value = false;
  }
}

async function refresh(probe = false) {
  if (state.busy) return;
  state.busy = true;
  state.message = probe ? 'Checking Chrome response…' : 'Refreshing status…';
  try {
    const response = await localRequest(probe ? '/status?probe=1' : '/status');
    if (!response.ok || !response.data) {
      state.phase = 'offline';
      state.data = null;
      state.message = response.error || `Service is not listening on ${PORT}`;
      return;
    }

    state.data = response.data;
    await refreshRuntime();
    const running = Boolean(response.data.server?.serviceRunning);
    const connected = Boolean(response.data.nativeHost?.connected);
    state.phase = running && connected ? 'running' : running ? 'waiting' : 'stopped';
    state.message = probe
      ? response.data.probe?.ok
        ? `Chrome responded normally · ${response.data.probe.elapsedMs} ms`
        : 'Chrome returned no valid response'
      : 'Status updated';
    state.lastUpdated = new Date().toLocaleTimeString();
  } finally {
    state.busy = false;
  }
}

async function startBridge() {
  if (!isTauri) return refresh();
  state.busy = true;
  state.message = 'Starting the bridge service…';
  try {
    await invoke('start_bridge');
  } catch (error) {
    state.phase = 'offline';
    state.message = error instanceof Error ? error.message : String(error);
  } finally {
    state.busy = false;
    await refresh();
  }
}

async function control(action: 'start' | 'stop') {
  state.busy = true;
  state.message = action === 'start' ? 'Starting the service…' : 'Stopping the service…';
  try {
    await localRequest(`/__chrome_mcp_bridge/${action}`, 'POST');
  } finally {
    state.busy = false;
    await refresh();
  }
}

async function openLog() {
  if (isTauri) {
    await invoke('open_log').catch((error) => {
      state.message = error instanceof Error ? error.message : String(error);
    });
  }
}

async function cancelMcpRequest(request: McpRequest) {
  if (cancellingRequestId.value) return;
  cancellingRequestId.value = request.requestId;
  state.message = 'Cancelling the MCP request…';
  try {
    const path = `/__chrome_mcp_bridge/requests/${encodeURIComponent(request.requestId)}/cancel`;
    const response = isTauri
      ? await invoke<BridgeResponse>('cancel_mcp_request', { requestId: request.requestId })
      : await localRequest(path, 'POST');
    state.message = response.ok
      ? 'Cancellation request sent'
      : response.error || 'Cancellation request failed';
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  } finally {
    cancellingRequestId.value = null;
    await refresh();
  }
}

function stopPolling() {
  if (timer !== undefined) window.clearInterval(timer);
  if (errorTimer !== undefined) window.clearInterval(errorTimer);
  timer = undefined;
  errorTimer = undefined;
}

function startPolling() {
  stopPolling();
  if (document.hidden) return;

  timer = window.setInterval(() => refresh(), STATUS_POLL_INTERVAL_MS);
  errorTimer = window.setInterval(
    () => refreshErrorDiagnostics(),
    ERROR_DIAGNOSTICS_POLL_INTERVAL_MS,
  );
}

function onVisibilityChange() {
  if (document.hidden) {
    stopPolling();
    return;
  }

  void refresh();
  void refreshErrorDiagnostics();
  startPolling();
}

onMounted(async () => {
  removeTrayListener = isTauri ? await listen('tray-health-check', () => refresh(true)) : undefined;
  document.addEventListener('visibilitychange', onVisibilityChange);
  await startBridge();
  await refreshErrorDiagnostics();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  removeTrayListener?.();
  document.body.classList.remove('modal-open');
});
</script>

<template>
  <main class="app-frame">
    <aside class="sidebar">
      <div class="window-controls" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="sidebar-brand">
        <span class="brand-mark"><AssetIcon name="cat" :size="48" /></span>
        <div
          ><strong>Catgirl Chrome MCP Server</strong
          ><small>CHROME MCP SERVER FOR ANYTHING</small></div
        >
      </div>
      <nav class="sidebar-nav" aria-label="Main navigation">
        <a
          class="nav-item"
          :class="{ active: activeNav === 'overview' }"
          href="#overview"
          @click="activeNav = 'overview'"
          ><AssetIcon name="home" class="nav-icon" :size="19" />Overview</a
        >
        <a
          class="nav-item"
          :class="{ active: activeNav === 'runtime-control' }"
          href="#runtime-control"
          @click="activeNav = 'runtime-control'"
          ><AssetIcon name="activity" class="nav-icon" :size="19" />Runtime control</a
        >
        <a
          class="nav-item"
          :class="{ active: activeNav === 'connections' }"
          href="#connections"
          @click="activeNav = 'connections'"
          ><AssetIcon name="message" class="nav-icon" :size="19" />MCP sessions</a
        >
        <a
          class="nav-item"
          :class="{ active: activeNav === 'transports' }"
          href="#transports"
          @click="activeNav = 'transports'"
          ><AssetIcon name="box" class="nav-icon" :size="19" />Tools</a
        >
        <a
          class="nav-item"
          :class="{ active: activeNav === 'actions' }"
          href="#actions"
          @click="activeNav = 'actions'"
          ><AssetIcon name="settings" class="nav-icon" :size="19" />Service config</a
        >
        <a
          class="nav-item"
          :class="{ active: activeNav === 'diagnostics' }"
          href="#diagnostics"
          @click="activeNav = 'diagnostics'"
          ><AssetIcon name="file" class="nav-icon" :size="19" />Logs</a
        >
        <a
          class="nav-item"
          :class="{ active: activeNav === 'settings' }"
          href="#diagnostics"
          @click="activeNav = 'settings'"
          ><AssetIcon name="sliders" class="nav-icon" :size="19" />Settings</a
        >
      </nav>
      <div class="sidebar-footer"
        ><span>Chrome MCP Bridge</span><span>v{{ APP_VERSION }}</span
        ><small>Build a more open AI browser.</small></div
      >
    </aside>

    <section class="workspace" id="overview">
      <div class="hero-character-layer" aria-hidden="true">
        <img src="/assets/illustrations/dashboard-catgirl-foreground-v2.webp" alt="" />
      </div>
      <header class="topbar">
        <div
          ><span class="topbar-kicker">LOCAL AUTOMATION RUNTIME</span
          ><span class="topbar-divider"></span><span class="topbar-page">Console</span></div
        >
        <div class="topbar-actions"
          ><span class="secure-badge"
            ><AssetIcon name="lock" :size="14" />Local secure connection</span
          ><button
            class="top-icon"
            type="button"
            aria-label="Refresh status"
            :disabled="state.busy"
            @click="refresh()"
            ><AssetIcon name="refresh" :size="18" :class="{ spinning: state.busy }" /></button
        ></div>
      </header>

      <section class="hero panel">
        <div class="hero-copy">
          <p class="eyebrow">LOCAL AUTOMATION RUNTIME</p>
          <h1>Chrome MCP Bridge</h1>
          <p class="subtitle">Let AI use your current Chrome safely and directly</p>
          <blockquote class="motto"
            >"The Way comes first: if plans are not set and decisions not made early, advance and
            retreat waver, and doubt breeds defeat."<cite>— Wei Liaozi, Quanling</cite></blockquote
          >
        </div>
        <div class="hero-status" :class="`tone-${phaseMeta.tone}`"
          ><span class="status-dot"></span>{{ phaseMeta.label }}</div
        >
      </section>

      <section class="metrics">
        <article class="metric panel accent-blue">
          <span class="metric-icon"><AssetIcon name="activity" :size="25" /></span>
          <img
            class="metric-decoration metric-decoration-pulse"
            src="/assets/illustrations/dashboard-motifs/status-pulse.webp"
            alt=""
            aria-hidden="true"
          />
          <span class="metric-label">Service status</span>
          <strong>{{ phaseMeta.label }}</strong>
          <small>{{ state.message }}</small>
        </article>
        <button
          class="metric metric-button panel accent-purple"
          type="button"
          :disabled="clients.length === 0 && !statelessMcp"
          :aria-label="`View ${sessions} active MCP sessions and stateless request monitoring`"
          @click="showClients = true"
        >
          <span class="metric-icon"><AssetIcon name="message" :size="25" /></span>
          <img
            class="metric-decoration metric-decoration-mascot"
            src="/assets/illustrations/dashboard-motifs/session-mascot.webp"
            alt=""
            aria-hidden="true"
          />
          <span class="metric-label">Active MCP sessions</span>
          <strong>{{ sessions }}</strong>
          <small>{{
            clients.length || statelessMcp
              ? 'Click to view connections and request monitoring'
              : 'No client details yet'
          }}</small>
          <span v-if="clients.length || statelessMcp" class="metric-action"
            >View details <AssetIcon name="chevron-right" :size="14" aria-hidden="true"
          /></span>
        </button>
        <article class="metric panel accent-green">
          <span class="metric-icon"><AssetIcon name="box" :size="25" /></span>
          <img
            class="metric-decoration metric-decoration-cube"
            src="/assets/illustrations/dashboard-motifs/tool-cube.webp"
            alt=""
            aria-hidden="true"
          />
          <span class="metric-label">Available tools</span>
          <strong>{{ toolCount }}</strong>
          <small>Browser control capabilities</small>
        </article>
      </section>

      <section class="runtime-control panel" id="runtime-control">
        <div class="card-heading">
          <div>
            <span class="section-kicker">RUNTIME CONTROL</span>
            <div class="heading-title"
              ><AssetIcon name="activity" :size="20" /><h2>Live runtime control</h2></div
            >
            <p class="card-subtitle"
              >Unified view of MCP, Agent and Workflow; the desktop app omits sensitive
              parameters.</p
            >
          </div>
          <div class="runtime-summary">
            <span class="live-pill"
              ><span class="pulse"></span>{{ runtimeActiveCount }} running</span
            >
            <button class="button secondary" type="button" @click="refreshRuntime"
              ><AssetIcon name="refresh" :size="14" />Refresh</button
            >
          </div>
        </div>
        <div class="runtime-toolbar">
          <label
            >Filter
            <select v-model="runtimeFilter">
              <option value="all">All statuses</option>
              <option value="running">Running</option>
              <option value="waiting">Waiting for Chrome</option>
              <option value="paused">Paused</option>
              <option value="success">Success</option>
              <option value="error">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="unknown">Unknown status</option>
            </select></label
          >
          <span class="runtime-security-note"
            ><AssetIcon name="lock" :size="13" />Redacted summary only</span
          >
        </div>
        <div class="runtime-layout">
          <div class="runtime-task-list">
            <button
              v-for="task in visibleRuntimeTasks"
              :key="task.summary.taskId"
              class="runtime-task-card"
              :class="{ selected: selectedRuntimeTask?.summary.taskId === task.summary.taskId }"
              type="button"
              @click="selectedRuntimeTaskId = task.summary.taskId"
            >
              <div class="runtime-task-top">
                <span class="runtime-kind">{{ runtimeKindLabel(task.summary.kind) }}</span>
                <span class="runtime-status" :class="runtimeStatusTone(task.summary.status)">
                  {{ runtimeStatusLabel(task.summary.status) }}
                </span>
              </div>
              <strong>{{ task.summary.label }}</strong>
              <small
                >{{ task.summary.toolName || 'Waiting for next step' }} ·
                {{ runtimeElapsed(task) }}</small
              >
              <small
                >{{ task.summary.origin || 'Origin not reported' }} · Tab
                {{ task.summary.tabId ?? '—' }}</small
              >
            </button>
            <div v-if="!visibleRuntimeTasks.length" class="runtime-empty">
              <img
                class="runtime-empty-art"
                src="/assets/illustrations/dashboard-motifs/task-gift-cat.webp"
                alt=""
                aria-hidden="true"
              />
              <strong>No tasks match the current filter.</strong>
              <small>Running MCP, Agent and Workflow tasks appear here.</small>
            </div>
          </div>
          <article v-if="selectedRuntimeTask" class="runtime-detail">
            <div class="runtime-detail-head">
              <div
                ><span class="runtime-kind">{{
                  runtimeKindLabel(selectedRuntimeTask.summary.kind)
                }}</span
                ><h3>{{ selectedRuntimeTask.summary.label }}</h3></div
              >
              <span
                class="runtime-status"
                :class="runtimeStatusTone(selectedRuntimeTask.summary.status)"
                >{{ runtimeStatusLabel(selectedRuntimeTask.summary.status) }}</span
              >
            </div>
            <dl class="runtime-info-list">
              <div
                ><dt>Current tool / step</dt
                ><dd>{{ selectedRuntimeTask.summary.toolName || '—' }}</dd></div
              >
              <div
                ><dt>Profile</dt
                ><dd>{{ selectedRuntimeTask.summary.profileId || 'Current Chrome' }}</dd></div
              >
              <div
                ><dt>Tab / origin</dt
                ><dd
                  >Tab {{ selectedRuntimeTask.summary.tabId ?? '—' }} ·
                  {{ selectedRuntimeTask.summary.origin || '—' }}</dd
                ></div
              >
              <div
                ><dt>Elapsed</dt><dd>{{ runtimeElapsed(selectedRuntimeTask) }}</dd></div
              >
            </dl>
            <p v-if="selectedRuntimeTask.summary.errorMessage" class="runtime-error">{{
              selectedRuntimeTask.summary.errorMessage
            }}</p>
            <div class="runtime-actions">
              <button
                class="button danger"
                type="button"
                :disabled="!selectedRuntimeTask.summary.cancelable || Boolean(runtimeActionTaskId)"
                @click="controlRuntimeTask(selectedRuntimeTask, 'cancel')"
                ><AssetIcon name="alert" :size="14" />Cancel</button
              >
              <button
                v-if="selectedRuntimeTask.summary.status !== 'paused'"
                class="button secondary"
                type="button"
                :disabled="!selectedRuntimeTask.summary.pausable || Boolean(runtimeActionTaskId)"
                @click="controlRuntimeTask(selectedRuntimeTask, 'pause')"
                ><AssetIcon name="pause" :size="14" />Pause</button
              >
              <button
                v-else
                class="button secondary"
                type="button"
                :disabled="Boolean(runtimeActionTaskId)"
                @click="controlRuntimeTask(selectedRuntimeTask, 'resume')"
                ><AssetIcon name="play" :size="14" />Resume</button
              >
              <button
                class="button secondary"
                type="button"
                :disabled="
                  selectedRuntimeTask.summary.tabId == null || Boolean(runtimeActionTaskId)
                "
                @click="controlRuntimeTask(selectedRuntimeTask, 'focus')"
                ><AssetIcon name="crosshair" :size="14" />Focus tab</button
              >
              <button
                class="button secondary"
                type="button"
                @click="copyValue(selectedRuntimeTask.summary.taskId)"
                ><AssetIcon name="copy" :size="14" />Copy ID</button
              >
            </div>
            <details class="runtime-events"
              ><summary>Timeline ({{ selectedRuntimeTask.events.length }})</summary
              ><div
                v-for="event in selectedRuntimeTask.events"
                :key="`${event.at}-${event.type}`"
                class="runtime-event"
                ><span>{{ formatActivity(event.at) }}</span
                ><b>{{ event.type }}</b
                ><small>{{ event.message || runtimeStatusLabel(event.status) }}</small></div
              ></details
            >
          </article>
          <div v-else class="runtime-detail runtime-empty">
            <img
              class="runtime-empty-art"
              src="/assets/illustrations/dashboard-motifs/task-document.webp"
              alt=""
              aria-hidden="true"
            />
            <strong>Select a task to view details.</strong>
            <small>Run status, timeline and actions appear here.</small>
          </div>
        </div>
      </section>

      <section class="two-column" id="connections">
        <article class="panel card">
          <div class="card-heading">
            <div>
              <span class="section-kicker">CONNECTION</span>
              <div class="heading-title"
                ><AssetIcon name="plug" :size="20" /><h2>Connection status</h2></div
              >
            </div>
            <span class="live-pill"><span class="pulse"></span>LIVE</span>
          </div>
          <div class="connection-list">
            <div class="connection-row">
              <span class="icon-bubble"><AssetIcon name="plug" :size="18" /></span>
              <div><b>Chrome extension</b><small>Current browser profile</small></div>
              <span class="state-text" :class="`text-${statusFor(extensionConnected)}`">{{
                extensionConnected ? 'Connected' : 'Not connected'
              }}</span
              ><AssetIcon name="chevron-right" class="row-chevron" :size="17" />
            </div>
            <div class="connection-row">
              <span class="icon-bubble"><AssetIcon name="cable" :size="18" /></span>
              <div><b>Native Host</b><small>Native Messaging channel</small></div>
              <span class="state-text" :class="`text-${statusFor(nativeConnected, true)}`">{{
                nativeConnected ? 'Connected' : 'Waiting to connect'
              }}</span
              ><AssetIcon name="chevron-right" class="row-chevron" :size="17" />
            </div>
            <div class="connection-row">
              <span class="icon-bubble"><AssetIcon name="search-check" :size="18" /></span>
              <div><b>Health check</b><small>End-to-end Chrome round trip</small></div>
              <span class="state-text" :class="`text-${statusFor(state.data?.probe?.ok, true)}`">{{
                state.data?.probe?.ok ? `${state.data.probe.elapsedMs} ms` : 'Manual check'
              }}</span
              ><AssetIcon name="chevron-right" class="row-chevron" :size="17" />
            </div>
          </div>
        </article>

        <article class="panel card">
          <div class="card-heading">
            <div>
              <span class="section-kicker">ENDPOINT</span>
              <div class="heading-title"
                ><AssetIcon name="server" :size="20" /><h2>Service info</h2></div
              >
            </div>
            <span class="local-only"><AssetIcon name="network" :size="14" />127.0.0.1</span>
          </div>
          <dl class="info-list">
            <div
              ><dt>MCP address</dt
              ><dd
                >http://127.0.0.1:{{ PORT }}/mcp
                <button
                  class="inline-icon"
                  type="button"
                  aria-label="Copy MCP address"
                  @click="copyValue(`http://127.0.0.1:${PORT}/mcp`)"
                  ><AssetIcon name="copy" :size="14" /></button></dd
            ></div>
            <div
              ><dt>Port</dt
              ><dd
                >{{ PORT }}
                <button
                  class="inline-icon"
                  type="button"
                  aria-label="Copy port"
                  @click="copyValue(String(PORT))"
                  ><AssetIcon name="copy" :size="14" /></button></dd
            ></div>
            <div
              ><dt>Last activity</dt
              ><dd>{{ formatActivity(state.data?.nativeHost?.lastActivityAt) }}</dd></div
            >
          </dl>
          <p class="privacy-note"
            ><span>●</span> Data stays on this machine, never through the cloud</p
          >
        </article>
      </section>

      <section class="panel card error-diagnostics-card">
        <div class="card-heading">
          <div>
            <span class="section-kicker">ERROR DIAGNOSTICS</span>
            <div class="heading-title"
              ><AssetIcon name="alert" :size="20" /><h2>Error diagnostics</h2></div
            >
            <p class="card-subtitle"
              >Counts extension errors per terminal and keeps raw logs for troubleshooting.</p
            >
          </div>
          <div class="error-diagnostics-actions">
            <button
              class="button secondary"
              type="button"
              :disabled="isRefreshingErrorDiagnostics || isClearingErrorDiagnostics"
              @click="refreshErrorDiagnostics()"
              ><AssetIcon name="refresh" :size="14" />{{
                isRefreshingErrorDiagnostics ? 'Refreshing…' : 'Refresh'
              }}</button
            >
            <button
              class="button primary"
              type="button"
              :disabled="!errorDiagnostics || isExportingErrorDiagnostics"
              @click="exportErrorDiagnostics"
              ><AssetIcon name="clipboard" :size="14" />{{
                isExportingErrorDiagnostics ? 'Exporting…' : 'Export JSON'
              }}</button
            >
            <button
              class="button danger"
              type="button"
              :disabled="!errorDiagnostics || isClearingErrorDiagnostics"
              @click="clearErrorDiagnostics"
              ><AssetIcon name="trash" :size="14" />{{
                isClearingErrorDiagnostics
                  ? 'Clearing…'
                  : errorTerminalFilter === 'all'
                    ? 'Clear all logs'
                    : 'Clear current terminal'
              }}</button
            >
          </div>
        </div>
        <div v-if="errorDiagnostics" class="error-diagnostics-body">
          <div class="error-diagnostics-toolbar">
            <label
              >Terminal
              <select v-model="errorTerminalFilter" @change="errorCategoryFilter = null">
                <option value="all">All terminals</option>
                <option
                  v-for="terminal in errorTerminalOptions"
                  :key="terminal.terminalId"
                  :value="terminal.terminalId"
                >
                  {{ terminal.name }} ({{ terminal.terminalId }})
                </option>
              </select>
            </label>
            <div class="error-diagnostics-filter-summary">
              <button
                v-if="errorCategoryFilter"
                class="error-filter-clear"
                type="button"
                @click="errorCategoryFilter = null"
              >
                Filtered: {{ selectedErrorCategoryLabel }} ×
              </button>
              <span class="error-diagnostics-total">{{ errorTotal }} errors</span>
            </div>
          </div>
          <div class="error-category-grid">
            <button
              v-for="row in errorCategoryRows"
              :key="row.category"
              class="error-category-item"
              :class="{ selected: errorCategoryFilter === row.category }"
              type="button"
              :disabled="row.count === 0"
              :aria-pressed="errorCategoryFilter === row.category"
              @click="toggleErrorCategory(row.category)"
            >
              <span>{{ row.label }}</span
              ><strong>{{ row.count }}</strong>
            </button>
          </div>
          <p v-if="!selectedTerminalLogs.length" class="error-category-empty"
            >No error records yet</p
          >
          <p v-if="errorDiagnostics.errors.length" class="diagnostic-warning">
            {{ errorDiagnostics.errors.join('; ') }}
          </p>
          <details class="error-log-details">
            <summary>View raw error logs ({{ visibleErrorLogs.length }})</summary>
            <pre>{{ errorLogText() || 'No error logs yet.' }}</pre>
          </details>
        </div>
        <p v-else class="error-diagnostics-empty">{{ errorDiagnosticsMessage }}</p>
      </section>

      <section class="panel card transport-card" id="transports">
        <div class="card-heading">
          <div>
            <span class="section-kicker">MCP TRANSPORTS</span>
            <div class="heading-title"
              ><AssetIcon name="cable" :size="20" /><h2>All service endpoints</h2></div
            >
          </div>
          <span class="local-only"><AssetIcon name="lock" :size="13" />LOCAL ONLY</span>
        </div>
        <div class="transport-grid">
          <div class="transport-entry">
            <span class="transport-icon tone-blue"><AssetIcon name="globe" :size="18" /></span>
            <strong>Streamable HTTP (compatible)</strong>
            <code>http://127.0.0.1:{{ PORT }}/mcp</code>
            <small>Keeps sessions, works with existing clients</small>
          </div>
          <div class="transport-entry transport-entry-new">
            <span class="transport-icon tone-purple"><AssetIcon name="link" :size="18" /></span>
            <strong>Streamable HTTP (preview)</strong>
            <code>http://127.0.0.1:{{ PORT }}/mcp-new</code>
            <small>MCP 2026-07-28, no sessions</small>
          </div>
          <div class="transport-entry">
            <span class="transport-icon tone-blue"><AssetIcon name="file" :size="18" /></span>
            <strong>SSE (legacy MCP)</strong>
            <code>http://127.0.0.1:{{ PORT }}/sse</code>
            <small>Message URL: /messages?sessionId=…</small>
          </div>
          <div class="transport-entry">
            <span class="transport-icon tone-amber"><AssetIcon name="terminal" :size="18" /></span>
            <strong>STDIO</strong>
            <code>mcp-chrome-stdio or EXE --stdio</code>
            <small>Connects internally over Streamable HTTP (compatible)</small>
          </div>
        </div>
      </section>

      <section class="action-bar panel" id="actions">
        <div class="action-copy"
          ><b><AssetIcon name="wrench" :size="15" />Quick actions</b
          ><small>{{
            state.lastUpdated ? `Last refreshed ${state.lastUpdated}` : 'Waiting for first refresh'
          }}</small></div
        >
        <button class="button secondary" :disabled="state.busy" @click="refresh()"
          ><AssetIcon name="refresh" :size="15" />Refresh status</button
        >
        <button class="button secondary" :disabled="state.busy" @click="refresh(true)"
          ><AssetIcon name="search-check" :size="15" />Health check</button
        >
        <button
          class="button primary"
          :disabled="state.busy || state.phase === 'offline'"
          @click="control('start')"
          ><AssetIcon name="server" :size="15" />Start service</button
        >
        <button
          class="button danger"
          :disabled="state.busy || !serverRunning"
          @click="control('stop')"
          ><AssetIcon name="check-circle" :size="15" />Stop service</button
        >
        <button class="button secondary" @click="openLog"
          ><AssetIcon name="file" :size="15" />Open log</button
        >
      </section>

      <section class="details panel" id="diagnostics">
        <div class="detail-head"
          ><span class="section-kicker"><AssetIcon name="activity" :size="13" /> DIAGNOSTICS</span
          ><span>Protocol V{{ protocolVersion }} · App v{{ APP_VERSION }}</span></div
        >
        <p>{{ state.message }}</p>
        <code>Native Messaging: com.chromemcp.nativehost</code>
      </section>

      <footer
        >Chrome MCP Bridge · Keeps running in the system tray after the window closes · F5 refreshes
        status</footer
      >

      <div
        v-if="showClients"
        class="modal-backdrop"
        role="presentation"
        @click.self="showClients = false"
        @keydown.esc.window="showClients = false"
      >
        <section
          class="modal panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clients-title"
        >
          <div class="modal-heading">
            <div>
              <span class="section-kicker">ACTIVE SESSIONS</span>
              <div class="heading-title"
                ><AssetIcon name="message" :size="20" /><h2 id="clients-title"
                  >Connected clients</h2
                ></div
              >
              <p>
                {{ sessions }} MCP sessions<span v-if="statelessMcp">
                  · plus {{ statelessMcp.requestCount }} stateless requests</span
                >
              </p>
            </div>
            <button
              class="icon-button"
              type="button"
              aria-label="Close client list"
              @click="showClients = false"
            >
              <AssetIcon name="close" :size="17" />
            </button>
          </div>

          <article v-if="statelessMcp" class="stateless-entry">
            <div class="client-entry-heading">
              <span class="client-avatar stateless-avatar"
                ><AssetIcon name="radio" :size="17"
              /></span>
              <div class="client-title">
                <strong>Streamable HTTP (preview)</strong>
                <small>Stateless request monitoring · {{ statelessMcp.endpoint }}</small>
              </div>
              <span class="client-connected stateless-connected">
                <span class="status-dot"></span
                >{{ statelessMcp.activeRequests ? 'Requesting' : 'Monitoring' }}
              </span>
            </div>
            <dl class="client-details stateless-details">
              <div class="client-detail-endpoint"
                ><dt>Endpoint</dt
                ><dd class="client-endpoint"
                  >http://127.0.0.1:{{ PORT }}{{ statelessMcp.endpoint }}</dd
                ></div
              >
              <div
                ><dt>Last client</dt
                ><dd>{{ statelessMcp.clientInfo?.name || 'Unknown client' }}</dd></div
              >
              <div
                ><dt>Last activity</dt
                ><dd>{{ formatActivity(statelessMcp.lastRequestAt || undefined) }}</dd></div
              >
              <div
                ><dt>Request count</dt><dd>{{ statelessMcp.requestCount }}</dd></div
              >
              <div
                ><dt>Last latency</dt
                ><dd :class="latencyTone(statelessMcp.lastRequestLatencyMs)">
                  {{ formatLatency(statelessMcp.lastRequestLatencyMs) }}
                </dd></div
              >
              <div v-if="statelessMcp.remoteAddress"
                ><dt>Remote address</dt><dd>{{ statelessMcp.remoteAddress }}</dd></div
              >
              <div v-if="statelessMcp.errorCount"
                ><dt>Error count</dt
                ><dd class="latency-danger">{{ statelessMcp.errorCount }}</dd></div
              >
            </dl>
            <p class="stateless-note"
              >Stateless mode creates no session ID; recent activity and latency are recorded per
              request.</p
            >
          </article>

          <div class="request-monitor global-request-monitor">
            <div class="request-monitor-heading">
              <strong
                ><AssetIcon name="activity" :size="14" />Active requests · currently
                executing</strong
              >
              <span>{{ activeMcpRequests.length }}</span>
            </div>
            <div v-if="activeMcpRequests.length" class="request-list">
              <article
                v-for="request in activeMcpRequests"
                :key="request.requestId"
                class="request-entry"
              >
                <div class="request-entry-copy">
                  <strong>{{ request.toolName || request.method }}</strong>
                  <small>
                    {{ requestTransportLabel(request) }} · {{ request.endpoint || 'MCP' }} · running
                    for {{ formatElapsed(request.elapsedMs) }}
                  </small>
                  <small
                    >Request ID: {{ shortRequestId(request.requestId)
                    }}<span v-if="request.jsonRpcId !== null">
                      · JSON-RPC ID: {{ request.jsonRpcId }}</span
                    ></small
                  >
                </div>
                <button
                  class="button danger request-cancel"
                  type="button"
                  :disabled="Boolean(cancellingRequestId) || Boolean(request.cancelRequestedAt)"
                  @click="cancelMcpRequest(request)"
                  >{{ request.cancelRequestedAt ? 'Cancelling…' : 'Cancel' }}</button
                >
              </article>
            </div>
            <p v-else class="request-empty">No MCP requests are executing right now.</p>
          </div>

          <div class="request-monitor global-request-monitor recent-request-monitor">
            <div class="request-monitor-heading">
              <button
                class="request-monitor-toggle"
                type="button"
                :aria-expanded="showRecentMcpRequests"
                aria-controls="recent-mcp-request-list"
                @click="showRecentMcpRequests = !showRecentMcpRequests"
              >
                <span
                  class="request-monitor-chevron"
                  :class="{ 'is-collapsed': !showRecentMcpRequests }"
                  aria-hidden="true"
                  ><AssetIcon name="chevron-right" :size="15"
                /></span>
                <strong
                  ><AssetIcon name="clipboard" :size="14" />Recent requests · completed
                  calls</strong
                >
              </button>
              <span>{{ recentMcpRequests.length }}</span>
            </div>
            <div id="recent-mcp-request-list" v-show="showRecentMcpRequests">
              <div v-if="recentMcpRequests.length" class="request-list recent-request-list">
                <article
                  v-for="request in recentMcpRequests"
                  :key="request.requestId"
                  class="request-entry"
                >
                  <div class="request-entry-copy">
                    <strong>{{ request.toolName || request.method }}</strong>
                    <small>
                      {{ requestTransportLabel(request) }} · {{ request.endpoint || 'MCP' }} ·
                      {{ formatElapsed(request.elapsedMs) }}
                    </small>
                    <small>
                      {{ formatActivity(request.startedAt) }} ·
                      <span :class="requestStatusClass(request.status)">
                        {{ requestStatusLabel(request.status) }}
                      </span>
                      <span v-if="request.error"> · {{ request.error }}</span>
                    </small>
                  </div>
                  <span class="request-status" :class="requestStatusClass(request.status)">
                    {{ requestStatusLabel(request.status) }}
                  </span>
                </article>
              </div>
              <p v-else class="request-empty">No completed tool calls or failed requests yet.</p>
            </div>
          </div>

          <div v-if="clients.length" class="client-list">
            <article v-for="client in clients" :key="client.sessionId" class="client-entry">
              <div class="client-entry-heading">
                <span class="client-avatar">{{ clientInitial(client) }}</span>
                <div class="client-title">
                  <strong>{{ clientName(client) }}</strong>
                  <small>{{ clientVersion(client) }}</small>
                </div>
                <span class="client-connected"><span class="status-dot"></span>Connected</span>
              </div>
              <dl class="client-details">
                <div
                  ><dt>Transport</dt><dd>{{ transportLabel(client) }}</dd></div
                >
                <div class="client-detail-endpoint"
                  ><dt>Endpoint</dt
                  ><dd class="client-endpoint">{{ endpointLabel(client) }}</dd></div
                >
                <div
                  ><dt>Session ID</dt
                  ><dd :title="client.sessionId">{{ shortSessionId(client.sessionId) }}</dd></div
                >
                <div
                  ><dt>Established</dt><dd>{{ formatActivity(client.createdAt) }}</dd></div
                >
                <div
                  ><dt>Connected for</dt><dd>{{ formatDuration(client.createdAt) }}</dd></div
                >
                <div
                  ><dt>Last activity</dt><dd>{{ formatActivity(client.lastActivityAt) }}</dd></div
                >
                <div
                  ><dt>Last latency</dt
                  ><dd :class="latencyTone(client.lastRequestLatencyMs)">
                    {{ formatLatency(client.lastRequestLatencyMs) }}
                  </dd></div
                >
                <div
                  ><dt>Average latency</dt
                  ><dd :class="latencyTone(client.averageRequestLatencyMs)">
                    {{ formatLatency(client.averageRequestLatencyMs) }}
                  </dd></div
                >
                <div
                  ><dt>Request count</dt><dd>{{ client.requestCount }}</dd></div
                >
                <div v-if="client.remoteAddress"
                  ><dt>Remote address</dt><dd>{{ client.remoteAddress }}</dd></div
                >
                <div v-if="client.activeRequests"
                  ><dt>In flight</dt><dd>{{ client.activeRequests }} requests</dd></div
                >
                <div v-if="client.maxRequestLatencyMs !== null"
                  ><dt>Peak latency</dt
                  ><dd :class="latencyTone(client.maxRequestLatencyMs)">{{
                    formatLatency(client.maxRequestLatencyMs)
                  }}</dd></div
                >
                <div v-if="client.p95RequestLatencyMs !== null"
                  ><dt>P95 latency</dt
                  ><dd :class="latencyTone(client.p95RequestLatencyMs)">{{
                    formatLatency(client.p95RequestLatencyMs)
                  }}</dd></div
                >
                <div v-if="client.errorCount"
                  ><dt>Error count</dt><dd class="latency-danger">{{ client.errorCount }}</dd></div
                >
              </dl>
              <p v-if="client.userAgent" class="client-user-agent" :title="client.userAgent">
                {{ client.userAgent }}
              </p>
            </article>
          </div>
          <div
            v-if="!clients.length && !statelessMcp && !activeMcpRequests.length"
            class="empty-clients"
          >
            <span class="empty-icon"><AssetIcon name="radio" :size="25" /></span>
            <strong>No clients to show yet</strong>
            <p
              >Once a client opens an MCP session, the name and version it reports in the initialize
              request appear here.</p
            >
          </div>

          <p class="modal-note"
            >Client names come from MCP initialize requests; active requests cover Streamable HTTP,
            SSE and STDIO endpoints. Latency is the server-side MCP request handling time, including
            browser tool execution, not a network ping. P95 only counts the most recent 100
            requests.</p
          >
        </section>
      </div>
    </section>
  </main>
</template>
