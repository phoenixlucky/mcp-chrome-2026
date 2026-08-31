<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

const PORT = 12306;
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
  transport: 'streamable-http' | 'sse';
  remoteAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivityAt: string;
  activeRequests: number;
  lastError: string | null;
};

const state = reactive({
  phase: 'checking' as 'checking' | 'running' | 'waiting' | 'stopped' | 'offline',
  message: '正在启动本地服务…',
  lastUpdated: '',
  busy: false,
  data: null as Record<string, any> | null,
});

let timer: number | undefined;
let removeTrayListener: UnlistenFn | undefined;

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
const clients = computed<McpClient[]>(() => {
  const value = state.data?.mcp?.clients;
  return Array.isArray(value) ? (value as McpClient[]) : [];
});
const showClients = ref(false);

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

function transportLabel(transport: McpClient['transport']) {
  return transport === 'sse' ? 'SSE' : 'Streamable HTTP';
}

function shortSessionId(sessionId: string) {
  return sessionId ? `…${sessionId.slice(-8)}` : '—';
}

async function localRequest(path: string, method = 'GET'): Promise<BridgeResponse> {
  if (isTauri) {
    if (path === '/status') return invoke<BridgeResponse>('get_status');
    if (path === '/status?probe=1') return invoke<BridgeResponse>('health_check');
    return invoke<BridgeResponse>('control_service', {
      action: path.endsWith('/start') ? 'start' : 'stop',
    });
  }

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}${path}`, { method });
    const data = await response.json().catch(() => undefined);
    return { ok: response.ok, status: response.status, data, error: data?.message };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
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

onMounted(async () => {
  removeTrayListener = isTauri ? await listen('tray-health-check', () => refresh(true)) : undefined;
  await startBridge();
  timer = window.setInterval(() => refresh(), 3000);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
  removeTrayListener?.();
  document.body.classList.remove('modal-open');
});
</script>

<template>
  <main class="shell">
    <section class="hero panel">
      <div class="brand-mark">✦</div>
      <div>
        <p class="eyebrow">LOCAL AUTOMATION RUNTIME</p>
        <h1>Chrome MCP Bridge</h1>
        <p class="subtitle">让 AI 安全、直接地使用你当前的 Chrome</p>
      </div>
      <div class="hero-status" :class="`tone-${phaseMeta.tone}`">
        <span class="status-dot"></span>
        {{ phaseMeta.label }}
      </div>
    </section>

    <section class="metrics">
      <article class="metric panel accent-blue">
        <span class="metric-label">服务状态</span>
        <strong>{{ phaseMeta.label }}</strong>
        <small>{{ state.message }}</small>
      </article>
      <button
        class="metric metric-button panel accent-purple"
        type="button"
        :disabled="clients.length === 0"
        :aria-label="`查看 ${sessions} 个活跃 MCP 会话的连接客户端`"
        @click="showClients = true"
      >
        <span class="metric-label">活跃 MCP 会话</span>
        <strong>{{ sessions }}</strong>
        <small>{{ clients.length ? '点击查看连接客户端' : '暂无客户端详情' }}</small>
        <span v-if="clients.length" class="metric-action"
          >查看详情 <span aria-hidden="true">↗</span></span
        >
      </button>
      <article class="metric panel accent-green">
        <span class="metric-label">可用工具</span>
        <strong>{{ toolCount }}</strong>
        <small>浏览器控制能力</small>
      </article>
    </section>

    <section class="two-column">
      <article class="panel card">
        <div class="card-heading">
          <div>
            <span class="section-kicker">CONNECTION</span>
            <h2>连接状态</h2>
          </div>
          <span class="live-pill"><span class="pulse"></span>LIVE</span>
        </div>
        <div class="connection-list">
          <div class="connection-row">
            <span class="icon-bubble">⌘</span>
            <div><b>Chrome 扩展</b><small>当前浏览器配置</small></div>
            <span class="state-text" :class="`text-${statusFor(extensionConnected)}`">{{
              extensionConnected ? '已连接' : '未连接'
            }}</span>
          </div>
          <div class="connection-row">
            <span class="icon-bubble">⇄</span>
            <div><b>Native Host</b><small>Native Messaging 通道</small></div>
            <span class="state-text" :class="`text-${statusFor(nativeConnected, true)}`">{{
              nativeConnected ? '已连接' : '等待连接'
            }}</span>
          </div>
          <div class="connection-row">
            <span class="icon-bubble">✓</span>
            <div><b>健康检查</b><small>端到端 Chrome 回包</small></div>
            <span class="state-text" :class="`text-${statusFor(state.data?.probe?.ok, true)}`">{{
              state.data?.probe?.ok ? `${state.data.probe.elapsedMs} ms` : '手动检查'
            }}</span>
          </div>
        </div>
      </article>

      <article class="panel card">
        <div class="card-heading">
          <div>
            <span class="section-kicker">ENDPOINT</span>
            <h2>服务信息</h2>
          </div>
          <span class="local-only">127.0.0.1</span>
        </div>
        <dl class="info-list">
          <div
            ><dt>MCP 地址</dt><dd>http://127.0.0.1:{{ PORT }}/mcp</dd></div
          >
          <div
            ><dt>端口</dt><dd>{{ PORT }}</dd></div
          >
          <div
            ><dt>最后活动</dt
            ><dd>{{ formatActivity(state.data?.nativeHost?.lastActivityAt) }}</dd></div
          >
        </dl>
        <p class="privacy-note"><span>●</span> 数据仅在本机传输，不经过云端</p>
      </article>
    </section>

    <section class="action-bar panel">
      <div class="action-copy"
        ><b>快捷操作</b
        ><small>{{
          state.lastUpdated ? `上次刷新 ${state.lastUpdated}` : '等待首次刷新'
        }}</small></div
      >
      <button class="button secondary" :disabled="state.busy" @click="refresh()">刷新状态</button>
      <button class="button secondary" :disabled="state.busy" @click="refresh(true)"
        >健康检查</button
      >
      <button
        class="button primary"
        :disabled="state.busy || state.phase === 'offline'"
        @click="control('start')"
        >启动服务</button
      >
      <button
        class="button danger"
        :disabled="state.busy || !serverRunning"
        @click="control('stop')"
        >停止服务</button
      >
      <button class="button secondary" @click="openLog">打开日志</button>
    </section>

    <section class="details panel">
      <div class="detail-head"
        ><span class="section-kicker">DIAGNOSTICS</span><span>v2.4.11</span></div
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
      <section class="modal panel" role="dialog" aria-modal="true" aria-labelledby="clients-title">
        <div class="modal-heading">
          <div>
            <span class="section-kicker">ACTIVE SESSIONS</span>
            <h2 id="clients-title">当前连接客户端</h2>
            <p>共 {{ sessions }} 个 MCP 会话</p>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="关闭客户端列表"
            @click="showClients = false"
          >
            ×
          </button>
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
                ><dt>传输</dt><dd>{{ transportLabel(client.transport) }}</dd></div
              >
              <div
                ><dt>会话 ID</dt
                ><dd :title="client.sessionId">{{ shortSessionId(client.sessionId) }}</dd></div
              >
              <div
                ><dt>建立时间</dt><dd>{{ formatActivity(client.createdAt) }}</dd></div
              >
              <div
                ><dt>最后活动</dt><dd>{{ formatActivity(client.lastActivityAt) }}</dd></div
              >
              <div v-if="client.remoteAddress"
                ><dt>来源地址</dt><dd>{{ client.remoteAddress }}</dd></div
              >
              <div v-if="client.activeRequests"
                ><dt>处理中</dt><dd>{{ client.activeRequests }} 个请求</dd></div
              >
            </dl>
            <p v-if="client.userAgent" class="client-user-agent" :title="client.userAgent">
              {{ client.userAgent }}
            </p>
          </article>
        </div>
        <div v-else class="empty-clients">
          <span class="empty-icon">⌁</span>
          <strong>暂时没有可显示的客户端</strong>
          <p>客户端建立 MCP 会话后，这里会显示它在初始化请求中报告的名称和版本。</p>
        </div>

        <p class="modal-note"
          >客户端名称来自 MCP initialize 请求；未提供信息的客户端会标记为“未识别客户端”。</p
        >
      </section>
    </div>
  </main>
</template>
