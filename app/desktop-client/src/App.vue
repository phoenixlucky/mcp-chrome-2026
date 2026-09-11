<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  Activity,
  ArrowRightLeft,
  Box,
  Cable,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  ClipboardList,
  Copy,
  FileText,
  Globe2,
  Home,
  Link2,
  LockKeyhole,
  MessageSquare,
  Network,
  PlugZap,
  RefreshCw,
  RadioTower,
  SearchCheck,
  Server,
  Settings,
  SlidersHorizontal,
  Terminal,
  Trash2,
  Wrench,
  X,
} from 'lucide-vue-next';

const PORT = 12306;
const APP_VERSION = __APP_VERSION__;
const isTauri = Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

type BridgeResponse = {
  ok: boolean;
  status: number;
  data?: Record<string, any>;
  error?: string;
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
  element_not_found: '元素找不到',
  element_not_actionable: '元素不可操作',
  navigation_cancelled: '导航被取消',
  selector_multiple_matches: '元素匹配多个',
  coordinate_target_missing: '坐标位置无元素',
  tab_missing: 'Tab 不存在',
  restricted_page: '受限页面不可注入',
  message_channel_closed: '消息通道关闭',
  proxy_error: '住宅代理错误',
  other: '其他错误',
};

const state = reactive({
  phase: 'checking' as 'checking' | 'running' | 'waiting' | 'stopped' | 'offline',
  message: '正在启动本地服务…',
  lastUpdated: '',
  busy: false,
  data: null as Record<string, any> | null,
});

let timer: number | undefined;
let errorTimer: number | undefined;
let removeTrayListener: UnlistenFn | undefined;
const errorDiagnostics = ref<ErrorDiagnostics | null>(null);
const errorDiagnosticsMessage = ref('尚未读取错误日志');
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

function classifyErrorMessage(message: string) {
  if (/住宅代理|代理(?:请求|测试|认证|配置|轮换)|proxy|tunnel/i.test(message)) return 'proxy_error';
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
      return { label: '运行中', tone: 'success' };
    case 'waiting':
      return { label: '等待 Chrome', tone: 'warning' };
    case 'stopped':
      return { label: '服务已停止', tone: 'warning' };
    case 'offline':
      return { label: '等待连接', tone: 'danger' };
    default:
      return { label: '检查中', tone: 'info' };
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
  if (!value) return '暂无活动';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function clientName(client: McpClient) {
  return client.clientInfo?.name || '未识别客户端';
}

function clientVersion(client: McpClient) {
  return client.clientInfo?.version || '版本未知';
}

function clientInitial(client: McpClient) {
  return clientName(client).slice(0, 1).toUpperCase();
}

function transportLabel(client: McpClient) {
  if (client.transport === 'stdio') return 'STDIO';
  if (client.endpoint === '/sse' || client.transport === 'sse') return 'SSE（旧版 MCP）';
  return 'Streamable HTTP（兼容版）';
}

function requestTransportLabel(request: McpRequest) {
  if (request.transport === 'stdio') return 'STDIO';
  if (request.transport === 'sse' || request.endpoint === '/sse') return 'SSE';
  if (request.endpoint === '/mcp-new') return 'Streamable HTTP（尝鲜版）';
  return 'Streamable HTTP（兼容版）';
}

function requestStatusLabel(status: McpRequest['status']) {
  if (status === 'success') return '成功';
  if (status === 'cancelled') return '已取消';
  if (status === 'error') return '失败';
  return '执行中';
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
  if (typeof value !== 'number') return '暂无请求';
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
  if (minutes < 1) return '不到 1 分钟';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时 ${minutes % 60} 分钟`;
  return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
}

function formatElapsed(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function shortRequestId(requestId: string) {
  return requestId ? `…${requestId.slice(-8)}` : '—';
}

async function copyValue(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    state.message = '已复制到剪贴板';
  } catch {
    state.message = '复制失败，请手动选择地址';
  }
}

async function localRequest(path: string, method = 'GET'): Promise<BridgeResponse> {
  if (isTauri) {
    if (path === '/status') return invoke<BridgeResponse>('get_status');
    if (path === '/__chrome_mcp_bridge/error-diagnostics')
      return invoke<BridgeResponse>('get_error_diagnostics');
    if (path === '/status?probe=1') return invoke<BridgeResponse>('health_check');
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
      errorDiagnosticsMessage.value = response.error || '错误诊断服务尚未连接';
      return;
    }
    errorDiagnostics.value = response.data as ErrorDiagnostics;
    errorDiagnosticsMessage.value = '错误日志已更新';
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
  const targetLabel = errorTerminalFilter.value === 'all' ? '全部终端' : '当前选中的终端';
  if (!window.confirm(`确定清除${targetLabel}的错误日志吗？此操作不可恢复。`)) return;

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
      const errors = Array.isArray(response.data?.errors) ? response.data.errors.join('；') : '';
      errorDiagnosticsMessage.value = response.error || errors || '错误日志清除失败';
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
    errorDiagnosticsMessage.value = '错误日志已清除';
    await refreshErrorDiagnostics(true);
  } finally {
    isClearingErrorDiagnostics.value = false;
  }
}

async function refresh(probe = false) {
  if (state.busy) return;
  state.busy = true;
  state.message = probe ? '正在检查 Chrome 响应…' : '正在刷新状态…';
  try {
    const response = await localRequest(probe ? '/status?probe=1' : '/status');
    if (!response.ok || !response.data) {
      state.phase = 'offline';
      state.data = null;
      state.message = response.error || `服务尚未监听 ${PORT}`;
      return;
    }

    state.data = response.data;
    const running = Boolean(response.data.server?.serviceRunning);
    const connected = Boolean(response.data.nativeHost?.connected);
    state.phase = running && connected ? 'running' : running ? 'waiting' : 'stopped';
    state.message = probe
      ? response.data.probe?.ok
        ? `Chrome 响应正常 · ${response.data.probe.elapsedMs} ms`
        : 'Chrome 没有返回有效响应'
      : '状态已更新';
    state.lastUpdated = new Date().toLocaleTimeString();
  } finally {
    state.busy = false;
  }
}

async function startBridge() {
  if (!isTauri) return refresh();
  state.busy = true;
  state.message = '正在启动桥接服务…';
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
  state.message = action === 'start' ? '正在启动服务…' : '正在停止服务…';
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
  state.message = '正在中断 MCP 请求…';
  try {
    const path = `/__chrome_mcp_bridge/requests/${encodeURIComponent(request.requestId)}/cancel`;
    const response = isTauri
      ? await invoke<BridgeResponse>('cancel_mcp_request', { requestId: request.requestId })
      : await localRequest(path, 'POST');
    state.message = response.ok ? '已发送中断请求' : response.error || '中断请求失败';
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  } finally {
    cancellingRequestId.value = null;
    await refresh();
  }
}

onMounted(async () => {
  removeTrayListener = isTauri ? await listen('tray-health-check', () => refresh(true)) : undefined;
  await startBridge();
  await refreshErrorDiagnostics();
  timer = window.setInterval(() => refresh(), 1000);
  errorTimer = window.setInterval(() => refreshErrorDiagnostics(), 1000);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
  if (errorTimer) window.clearInterval(errorTimer);
  removeTrayListener?.();
  document.body.classList.remove('modal-open');
});
</script>

<template>
  <main class="app-frame">
    <aside class="sidebar">
      <div class="window-controls" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="sidebar-brand">
        <span class="brand-mark"><span class="brand-spark"></span></span>
        <div><strong>Chrome MCP Bridge</strong><small>Local Automation Runtime</small></div>
      </div>
      <nav class="sidebar-nav" aria-label="主导航">
        <a class="nav-item active" href="#overview"><Home class="nav-icon" :size="19" />概览</a>
        <a class="nav-item" href="#connections"
          ><MessageSquare class="nav-icon" :size="19" />MCP 会话</a
        >
        <a class="nav-item" href="#transports"><Box class="nav-icon" :size="19" />工具管理</a>
        <a class="nav-item" href="#actions"><Settings class="nav-icon" :size="19" />服务配置</a>
        <a class="nav-item" href="#diagnostics"><FileText class="nav-icon" :size="19" />日志中心</a>
        <a class="nav-item" href="#diagnostics"
          ><SlidersHorizontal class="nav-icon" :size="19" />设置</a
        >
      </nav>
      <div class="sidebar-footer"
        ><span>Chrome MCP Bridge</span><span>v{{ APP_VERSION }}</span
        ><small>Build a more open AI browser.</small></div
      >
    </aside>

    <section class="workspace" id="overview">
      <header class="topbar">
        <div
          ><span class="topbar-kicker">LOCAL AUTOMATION RUNTIME</span
          ><span class="topbar-divider"></span><span class="topbar-page">控制台</span></div
        >
        <div class="topbar-actions"
          ><span class="secure-badge"><span class="mini-lock"></span>本机安全连接</span
          ><button
            class="top-icon"
            type="button"
            aria-label="刷新状态"
            :disabled="state.busy"
            @click="refresh()"
            ><RefreshCw :size="18" :stroke-width="1.8" :class="{ spinning: state.busy }" /></button
        ></div>
      </header>

      <section class="hero panel">
        <div class="hero-copy">
          <p class="eyebrow">LOCAL AUTOMATION RUNTIME</p>
          <h1>Chrome MCP Bridge</h1>
          <p class="subtitle">让 AI 安全、直接地使用你当前的 Chrome</p>
          <blockquote class="motto"
            >“夫蚤决先定，若计不先定，虑不蚤决，则进退不定，疑生必败。”<cite
              >—《尉缭子·勒卒令》</cite
            ></blockquote
          >
        </div>
        <div class="hero-visual" aria-hidden="true"
          ><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div
          ><div class="hero-core"><span class="brand-spark"></span></div
          ><div class="hero-glow"></div
        ></div>
        <div class="hero-status" :class="`tone-${phaseMeta.tone}`"
          ><span class="status-dot"></span>{{ phaseMeta.label }}</div
        >
      </section>

      <section class="metrics">
        <article class="metric panel accent-blue">
          <span class="metric-icon"><Activity :size="21" /></span>
          <span class="metric-label">服务状态</span>
          <strong>{{ phaseMeta.label }}</strong>
          <small>{{ state.message }}</small>
        </article>
        <button
          class="metric metric-button panel accent-purple"
          type="button"
          :disabled="clients.length === 0 && !statelessMcp"
          :aria-label="`查看 ${sessions} 个活跃 MCP 会话和无会话请求监控`"
          @click="showClients = true"
        >
          <span class="metric-icon"><MessageSquare :size="21" /></span>
          <span class="metric-label">活跃 MCP 会话</span>
          <strong>{{ sessions }}</strong>
          <small>{{
            clients.length || statelessMcp ? '点击查看连接与请求监控' : '暂无客户端详情'
          }}</small>
          <span v-if="clients.length || statelessMcp" class="metric-action"
            >查看详情 <ChevronRight :size="14" aria-hidden="true"
          /></span>
        </button>
        <article class="metric panel accent-green">
          <span class="metric-icon"><Box :size="21" /></span>
          <span class="metric-label">可用工具</span>
          <strong>{{ toolCount }}</strong>
          <small>浏览器控制能力</small>
        </article>
      </section>

      <section class="two-column" id="connections">
        <article class="panel card">
          <div class="card-heading">
            <div>
              <span class="section-kicker">CONNECTION</span>
              <div class="heading-title"><PlugZap :size="20" /><h2>连接状态</h2></div>
            </div>
            <span class="live-pill"><span class="pulse"></span>LIVE</span>
          </div>
          <div class="connection-list">
            <div class="connection-row">
              <span class="icon-bubble"><PlugZap :size="18" /></span>
              <div><b>Chrome 扩展</b><small>当前浏览器配置</small></div>
              <span class="state-text" :class="`text-${statusFor(extensionConnected)}`">{{
                extensionConnected ? '已连接' : '未连接'
              }}</span
              ><ChevronRight class="row-chevron" :size="17" />
            </div>
            <div class="connection-row">
              <span class="icon-bubble"><ArrowRightLeft :size="18" /></span>
              <div><b>Native Host</b><small>Native Messaging 通道</small></div>
              <span class="state-text" :class="`text-${statusFor(nativeConnected, true)}`">{{
                nativeConnected ? '已连接' : '等待连接'
              }}</span
              ><ChevronRight class="row-chevron" :size="17" />
            </div>
            <div class="connection-row">
              <span class="icon-bubble"><SearchCheck :size="18" /></span>
              <div><b>健康检查</b><small>端到端 Chrome 回包</small></div>
              <span class="state-text" :class="`text-${statusFor(state.data?.probe?.ok, true)}`">{{
                state.data?.probe?.ok ? `${state.data.probe.elapsedMs} ms` : '手动检查'
              }}</span
              ><ChevronRight class="row-chevron" :size="17" />
            </div>
          </div>
        </article>

        <article class="panel card">
          <div class="card-heading">
            <div>
              <span class="section-kicker">ENDPOINT</span>
              <div class="heading-title"><Server :size="20" /><h2>服务信息</h2></div>
            </div>
            <span class="local-only"><Network :size="14" />127.0.0.1</span>
          </div>
          <dl class="info-list">
            <div
              ><dt>MCP 地址</dt
              ><dd
                >http://127.0.0.1:{{ PORT }}/mcp
                <button
                  class="inline-icon"
                  type="button"
                  aria-label="复制 MCP 地址"
                  @click="copyValue(`http://127.0.0.1:${PORT}/mcp`)"
                  ><Copy :size="14" /></button></dd
            ></div>
            <div
              ><dt>端口</dt
              ><dd
                >{{ PORT }}
                <button
                  class="inline-icon"
                  type="button"
                  aria-label="复制端口"
                  @click="copyValue(String(PORT))"
                  ><Copy :size="14" /></button></dd
            ></div>
            <div
              ><dt>最后活动</dt
              ><dd>{{ formatActivity(state.data?.nativeHost?.lastActivityAt) }}</dd></div
            >
          </dl>
          <p class="privacy-note"><span>●</span> 数据仅在本机传输，不经过云端</p>
        </article>
      </section>

      <section class="panel card error-diagnostics-card">
        <div class="card-heading">
          <div>
            <span class="section-kicker">ERROR DIAGNOSTICS</span>
            <div class="heading-title"><CircleAlert :size="20" /><h2>错误诊断板块</h2></div>
            <p class="card-subtitle">统计每个终端的插件错误，并保留原始日志供排查。</p>
          </div>
          <div class="error-diagnostics-actions">
            <button
              class="button secondary"
              type="button"
              :disabled="isRefreshingErrorDiagnostics || isClearingErrorDiagnostics"
              @click="refreshErrorDiagnostics()"
              ><RefreshCw :size="14" />{{
                isRefreshingErrorDiagnostics ? '刷新中…' : '刷新'
              }}</button
            >
            <button
              class="button primary"
              type="button"
              :disabled="!errorDiagnostics || isExportingErrorDiagnostics"
              @click="exportErrorDiagnostics"
              ><ClipboardList :size="14" />{{
                isExportingErrorDiagnostics ? '导出中…' : '导出 JSON'
              }}</button
            >
            <button
              class="button danger"
              type="button"
              :disabled="!errorDiagnostics || isClearingErrorDiagnostics"
              @click="clearErrorDiagnostics"
              ><Trash2 :size="14" />{{
                isClearingErrorDiagnostics
                  ? '清除中…'
                  : errorTerminalFilter === 'all'
                    ? '清除全部日志'
                    : '清除当前终端'
              }}</button
            >
          </div>
        </div>
        <div v-if="errorDiagnostics" class="error-diagnostics-body">
          <div class="error-diagnostics-toolbar">
            <label
              >终端
              <select v-model="errorTerminalFilter" @change="errorCategoryFilter = null">
                <option value="all">全部终端</option>
                <option
                  v-for="terminal in errorTerminalOptions"
                  :key="terminal.terminalId"
                  :value="terminal.terminalId"
                >
                  {{ terminal.name }}（{{ terminal.terminalId }}）
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
                已筛选：{{ selectedErrorCategoryLabel }} ×
              </button>
              <span class="error-diagnostics-total">{{ errorTotal }} 条错误</span>
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
          <p v-if="!selectedTerminalLogs.length" class="error-category-empty">暂无错误记录</p>
          <p v-if="errorDiagnostics.errors.length" class="diagnostic-warning">
            {{ errorDiagnostics.errors.join('；') }}
          </p>
          <details class="error-log-details">
            <summary>查看原始错误日志（{{ visibleErrorLogs.length }} 条）</summary>
            <pre>{{ errorLogText() || '暂无错误日志。' }}</pre>
          </details>
        </div>
        <p v-else class="error-diagnostics-empty">{{ errorDiagnosticsMessage }}</p>
      </section>

      <section class="panel card transport-card" id="transports">
        <div class="card-heading">
          <div>
            <span class="section-kicker">MCP TRANSPORTS</span>
            <div class="heading-title"><Cable :size="20" /><h2>全部服务入口</h2></div>
          </div>
          <span class="local-only"><LockKeyhole :size="13" />LOCAL ONLY</span>
        </div>
        <div class="transport-grid">
          <div class="transport-entry">
            <span class="transport-icon tone-blue"><Globe2 :size="18" /></span>
            <strong>Streamable HTTP（兼容版）</strong>
            <code>http://127.0.0.1:{{ PORT }}/mcp</code>
            <small>保留会话，兼容现有客户端</small>
          </div>
          <div class="transport-entry transport-entry-new">
            <span class="transport-icon tone-purple"><Link2 :size="18" /></span>
            <strong>Streamable HTTP（尝鲜版）</strong>
            <code>http://127.0.0.1:{{ PORT }}/mcp-new</code>
            <small>MCP 2026-07-28，无会话</small>
          </div>
          <div class="transport-entry">
            <span class="transport-icon tone-blue"><FileText :size="18" /></span>
            <strong>SSE（旧版 MCP）</strong>
            <code>http://127.0.0.1:{{ PORT }}/sse</code>
            <small>消息地址：/messages?sessionId=…</small>
          </div>
          <div class="transport-entry">
            <span class="transport-icon tone-amber"><Terminal :size="18" /></span>
            <strong>STDIO</strong>
            <code>mcp-chrome-stdio 或 EXE --stdio</code>
            <small>内部连接 Streamable HTTP（兼容版）</small>
          </div>
        </div>
      </section>

      <section class="action-bar panel" id="actions">
        <div class="action-copy"
          ><b><Wrench :size="15" />快捷操作</b
          ><small>{{
            state.lastUpdated ? `上次刷新 ${state.lastUpdated}` : '等待首次刷新'
          }}</small></div
        >
        <button class="button secondary" :disabled="state.busy" @click="refresh()"
          ><RefreshCw :size="15" />刷新状态</button
        >
        <button class="button secondary" :disabled="state.busy" @click="refresh(true)"
          ><SearchCheck :size="15" />健康检查</button
        >
        <button
          class="button primary"
          :disabled="state.busy || state.phase === 'offline'"
          @click="control('start')"
          ><Server :size="15" />启动服务</button
        >
        <button
          class="button danger"
          :disabled="state.busy || !serverRunning"
          @click="control('stop')"
          ><CircleCheck :size="15" />停止服务</button
        >
        <button class="button secondary" @click="openLog"><FileText :size="15" />打开日志</button>
      </section>

      <section class="details panel" id="diagnostics">
        <div class="detail-head"
          ><span class="section-kicker"><Activity :size="13" /> DIAGNOSTICS</span
          ><span>通信协议 V{{ protocolVersion }} · 应用 v{{ APP_VERSION }}</span></div
        >
        <p>{{ state.message }}</p>
        <code>Native Messaging：com.chromemcp.nativehost</code>
      </section>

      <footer>Chrome MCP Bridge · 关闭窗口后继续驻留系统托盘 · F5 刷新状态</footer>

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
                ><MessageSquare :size="20" /><h2 id="clients-title">当前连接客户端</h2></div
              >
              <p>
                共 {{ sessions }} 个 MCP 会话<span v-if="statelessMcp">
                  · 另有 {{ statelessMcp.requestCount }} 次无会话请求</span
                >
              </p>
            </div>
            <button
              class="icon-button"
              type="button"
              aria-label="关闭客户端列表"
              @click="showClients = false"
            >
              <X :size="17" />
            </button>
          </div>

          <article v-if="statelessMcp" class="stateless-entry">
            <div class="client-entry-heading">
              <span class="client-avatar stateless-avatar"><RadioTower :size="17" /></span>
              <div class="client-title">
                <strong>Streamable HTTP（尝鲜版）</strong>
                <small>无会话请求监控 · {{ statelessMcp.endpoint }}</small>
              </div>
              <span class="client-connected stateless-connected">
                <span class="status-dot"></span
                >{{ statelessMcp.activeRequests ? '请求中' : '已监控' }}
              </span>
            </div>
            <dl class="client-details stateless-details">
              <div class="client-detail-endpoint"
                ><dt>服务入口</dt
                ><dd class="client-endpoint"
                  >http://127.0.0.1:{{ PORT }}{{ statelessMcp.endpoint }}</dd
                ></div
              >
              <div
                ><dt>最近客户端</dt
                ><dd>{{ statelessMcp.clientInfo?.name || '未识别客户端' }}</dd></div
              >
              <div
                ><dt>最近活动</dt
                ><dd>{{ formatActivity(statelessMcp.lastRequestAt || undefined) }}</dd></div
              >
              <div
                ><dt>请求数</dt><dd>{{ statelessMcp.requestCount }} 次</dd></div
              >
              <div
                ><dt>最近耗时</dt
                ><dd :class="latencyTone(statelessMcp.lastRequestLatencyMs)">
                  {{ formatLatency(statelessMcp.lastRequestLatencyMs) }}
                </dd></div
              >
              <div v-if="statelessMcp.remoteAddress"
                ><dt>来源地址</dt><dd>{{ statelessMcp.remoteAddress }}</dd></div
              >
              <div v-if="statelessMcp.errorCount"
                ><dt>错误次数</dt
                ><dd class="latency-danger">{{ statelessMcp.errorCount }} 次</dd></div
              >
            </dl>
            <p class="stateless-note"
              >无会话模式不会生成 session ID，这里按请求记录最近活动与耗时。</p
            >
          </article>

          <div class="request-monitor global-request-monitor">
            <div class="request-monitor-heading">
              <strong><Activity :size="14" />活动请求 · 当前仍在执行</strong>
              <span>{{ activeMcpRequests.length }} 个</span>
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
                    {{ requestTransportLabel(request) }} · {{ request.endpoint || 'MCP' }} · 已运行
                    {{ formatElapsed(request.elapsedMs) }}
                  </small>
                  <small
                    >请求 ID：{{ shortRequestId(request.requestId)
                    }}<span v-if="request.jsonRpcId !== null">
                      · JSON-RPC ID：{{ request.jsonRpcId }}</span
                    ></small
                  >
                </div>
                <button
                  class="button danger request-cancel"
                  type="button"
                  :disabled="Boolean(cancellingRequestId) || Boolean(request.cancelRequestedAt)"
                  @click="cancelMcpRequest(request)"
                  >{{ request.cancelRequestedAt ? '中断中…' : '中断' }}</button
                >
              </article>
            </div>
            <p v-else class="request-empty">当前没有执行中的 MCP 请求。</p>
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
                  ><ChevronRight :size="15"
                /></span>
                <strong><ClipboardList :size="14" />最近请求 · 已完成的调用记录</strong>
              </button>
              <span>{{ recentMcpRequests.length }} 条</span>
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
              <p v-else class="request-empty">暂无已完成的工具调用或失败请求。</p>
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
                <span class="client-connected"><span class="status-dot"></span>已连接</span>
              </div>
              <dl class="client-details">
                <div
                  ><dt>连接方式</dt><dd>{{ transportLabel(client) }}</dd></div
                >
                <div class="client-detail-endpoint"
                  ><dt>服务入口</dt
                  ><dd class="client-endpoint">{{ endpointLabel(client) }}</dd></div
                >
                <div
                  ><dt>会话 ID</dt
                  ><dd :title="client.sessionId">{{ shortSessionId(client.sessionId) }}</dd></div
                >
                <div
                  ><dt>建立时间</dt><dd>{{ formatActivity(client.createdAt) }}</dd></div
                >
                <div
                  ><dt>连接时长</dt><dd>{{ formatDuration(client.createdAt) }}</dd></div
                >
                <div
                  ><dt>最后活动</dt><dd>{{ formatActivity(client.lastActivityAt) }}</dd></div
                >
                <div
                  ><dt>最近耗时</dt
                  ><dd :class="latencyTone(client.lastRequestLatencyMs)">
                    {{ formatLatency(client.lastRequestLatencyMs) }}
                  </dd></div
                >
                <div
                  ><dt>平均耗时</dt
                  ><dd :class="latencyTone(client.averageRequestLatencyMs)">
                    {{ formatLatency(client.averageRequestLatencyMs) }}
                  </dd></div
                >
                <div
                  ><dt>请求数</dt><dd>{{ client.requestCount }} 次</dd></div
                >
                <div v-if="client.remoteAddress"
                  ><dt>来源地址</dt><dd>{{ client.remoteAddress }}</dd></div
                >
                <div v-if="client.activeRequests"
                  ><dt>处理中</dt><dd>{{ client.activeRequests }} 个请求</dd></div
                >
                <div v-if="client.maxRequestLatencyMs !== null"
                  ><dt>峰值耗时</dt
                  ><dd :class="latencyTone(client.maxRequestLatencyMs)">{{
                    formatLatency(client.maxRequestLatencyMs)
                  }}</dd></div
                >
                <div v-if="client.p95RequestLatencyMs !== null"
                  ><dt>P95 耗时</dt
                  ><dd :class="latencyTone(client.p95RequestLatencyMs)">{{
                    formatLatency(client.p95RequestLatencyMs)
                  }}</dd></div
                >
                <div v-if="client.errorCount"
                  ><dt>错误次数</dt><dd class="latency-danger">{{ client.errorCount }} 次</dd></div
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
            <span class="empty-icon"><RadioTower :size="25" /></span>
            <strong>暂时没有可显示的客户端</strong>
            <p>客户端建立 MCP 会话后，这里会显示它在初始化请求中报告的名称和版本。</p>
          </div>

          <p class="modal-note"
            >客户端名称来自 MCP initialize 请求；活动请求覆盖 Streamable HTTP、SSE 和 STDIO
            入口。耗时为服务端统计的 MCP 请求处理耗时，包含浏览器工具执行时间，不是网络 Ping。P95
            只统计最近 100 次请求。</p
          >
        </section>
      </div>
    </section>
  </main>
</template>
