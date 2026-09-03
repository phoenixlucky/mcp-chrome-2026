import {
  NativeMessageType,
  NATIVE_PROTOCOL_VERSION,
  NativeProtocolError,
  createNativeCapabilities,
  createNativeHello,
  createNativeErrorResponse,
  parseNativeProtocolMessage,
  negotiateNativeProtocolVersion,
  type NativeProtocolMessage,
  type NativeRequest,
  type NativeConnectionState,
} from '@ethanwilkins/chrome-mcp-shared-2026';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { NATIVE_HOST, STORAGE_KEYS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/common/constants';
import { handleCallTool } from './tools';
import { enqueueFlow, getFlow, listFlows } from './record-replay-v3/public-api';
import { acquireKeepalive } from './keepalive-manager';

const LOG_PREFIX = '[NativeHost]';

let nativePort: chrome.runtime.Port | null = null;
let nativeConnectionState: NativeConnectionState = 'stopped';
let negotiatedVersion: number | undefined;
let nativeCapabilities: NativeConnectionSnapshot['capabilities'];
let eventSocket: WebSocket | null = null;
let eventHeartbeat: ReturnType<typeof setInterval> | null = null;
let eventKeepaliveRelease: (() => void) | null = null;
const activeToolCalls = new Map<string, AbortController>();
const respondedProtocolRequests = new Set<string>();
const forwardedFileRequests = new Set<string>();
const MAX_DEDUPLICATED_REQUESTS = 4096;
export const HOST_NAME = NATIVE_HOST.NAME;

// ==================== Reconnect Configuration ====================

const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 60_000;
const RECONNECT_MAX_FAST_ATTEMPTS = 8;
const RECONNECT_COOLDOWN_DELAY_MS = 5 * 60_000;

// ==================== Auto-connect State ====================

let keepaliveRelease: (() => void) | null = null;
let autoConnectEnabled = true;
let autoConnectLoaded = false;
let ensurePromise: Promise<boolean> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let manualDisconnect = false;
let statusReady: Promise<void> = Promise.resolve();

/**
 * Server status management interface
 */
interface ServerStatus {
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}

let currentServerStatus: ServerStatus = {
  isRunning: false,
  lastUpdated: Date.now(),
};

interface NativeConnectionSnapshot {
  state: NativeConnectionState;
  updatedAt: number;
  negotiatedVersion?: number;
  capabilities?: { methods: string[]; events: string[]; features: string[] };
  lastError?: string;
}

function persistNativeConnectionState(lastError?: string): void {
  const snapshot: NativeConnectionSnapshot = {
    state: nativeConnectionState,
    updatedAt: Date.now(),
    ...(negotiatedVersion ? { negotiatedVersion } : {}),
    ...(nativeCapabilities ? { capabilities: nativeCapabilities } : {}),
    ...(lastError ? { lastError } : {}),
  };
  void chrome.storage.local
    .set({ [STORAGE_KEYS.NATIVE_CONNECTION_STATE]: snapshot })
    .catch((error) => console.warn(`${LOG_PREFIX} Failed to persist connection state`, error));
}

function setNativeConnectionState(state: NativeConnectionState, lastError?: string): void {
  if (nativeConnectionState === state && !lastError) return;
  nativeConnectionState = state;
  persistNativeConnectionState(lastError);
}

export async function loadNativeConnectionState(): Promise<void> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.NATIVE_CONNECTION_STATE]);
    const stored = result[
      STORAGE_KEYS.NATIVE_CONNECTION_STATE
    ] as Partial<NativeConnectionSnapshot>;
    if (
      stored?.state &&
      ['starting', 'connected', 'ready', 'degraded', 'stopped'].includes(stored.state)
    ) {
      nativeConnectionState = stored.state as NativeConnectionState;
    }
    if (typeof stored?.negotiatedVersion === 'number') negotiatedVersion = stored.negotiatedVersion;
    if (stored?.capabilities) nativeCapabilities = stored.capabilities;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to load connection state`, error);
  }
}

/**
 * Save server status to chrome.storage
 */
async function saveServerStatus(status: ServerStatus): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SERVER_STATUS]: status });
  } catch (error) {
    console.error(ERROR_MESSAGES.SERVER_STATUS_SAVE_FAILED, error);
  }
}

/**
 * Load server status from chrome.storage
 */
async function loadServerStatus(): Promise<ServerStatus> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SERVER_STATUS]);
    if (result[STORAGE_KEYS.SERVER_STATUS]) {
      return result[STORAGE_KEYS.SERVER_STATUS];
    }
  } catch (error) {
    console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
  }
  return {
    isRunning: false,
    lastUpdated: Date.now(),
  };
}

/**
 * Broadcast server status change to all listeners
 */
function broadcastServerStatusChange(status: ServerStatus): void {
  chrome.runtime
    .sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED,
      payload: status,
    })
    .catch(() => {
      // Ignore errors if no listeners are present
    });
}

// ==================== Port Normalization ====================

/**
 * Normalize a port value to a valid port number or null.
 */
function normalizePort(value: unknown): number | null {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  const port = Math.floor(n);
  if (port <= 0 || port > 65535) return null;
  return port;
}

// ==================== Reconnect Utilities ====================

/**
 * Add jitter to a delay value to avoid thundering herd.
 */
function withJitter(ms: number): number {
  const ratio = 0.7 + Math.random() * 0.6;
  return Math.max(0, Math.round(ms * ratio));
}

/**
 * Calculate reconnect delay based on attempt number.
 * Uses exponential backoff with jitter, then switches to cooldown interval.
 */
function getReconnectDelayMs(attempt: number): number {
  if (attempt >= RECONNECT_MAX_FAST_ATTEMPTS) {
    return withJitter(RECONNECT_COOLDOWN_DELAY_MS);
  }
  const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt), RECONNECT_MAX_DELAY_MS);
  return withJitter(delay);
}

/**
 * Clear the reconnect timer if active.
 */
function clearReconnectTimer(): void {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

/**
 * Reset reconnect state after successful connection.
 */
function resetReconnectState(): void {
  reconnectAttempts = 0;
  clearReconnectTimer();
}

function postProtocolResponseOnce(request: NativeRequest, response: Record<string, unknown>): void {
  if (respondedProtocolRequests.has(request.requestId)) return;
  if (respondedProtocolRequests.size >= MAX_DEDUPLICATED_REQUESTS) {
    const oldest = respondedProtocolRequests.values().next().value;
    if (typeof oldest === 'string') respondedProtocolRequests.delete(oldest);
  }
  respondedProtocolRequests.add(request.requestId);
  nativePort?.postMessage(response);
}

function protocolErrorResponse(
  request: NativeRequest,
  code: NativeProtocolError['code'],
  message: string,
) {
  return createNativeErrorResponse(request, new NativeProtocolError(code, message));
}

export function getNativeConnectionState(): NativeConnectionState {
  return nativeConnectionState;
}

function closeEventChannel(): void {
  if (eventHeartbeat) clearInterval(eventHeartbeat);
  eventHeartbeat = null;
  if (eventSocket) {
    try {
      eventSocket.close();
    } catch {
      // The socket may already be closed.
    }
  }
  eventSocket = null;
  if (eventKeepaliveRelease) {
    eventKeepaliveRelease();
    eventKeepaliveRelease = null;
  }
}

function connectEventChannel(data: unknown): void {
  const info = data as { port?: unknown; token?: unknown; expiresAt?: unknown };
  if (
    typeof info?.port !== 'number' ||
    typeof info.token !== 'string' ||
    typeof info.expiresAt !== 'number' ||
    info.expiresAt <= Date.now()
  )
    return;
  closeEventChannel();
  const socket = new WebSocket(
    `ws://127.0.0.1:${info.port}/events?token=${encodeURIComponent(info.token)}`,
  );
  eventSocket = socket;
  socket.onopen = () => {
    if (eventSocket !== socket) return;
    eventKeepaliveRelease = acquireKeepalive('native-event-channel');
    eventHeartbeat = setInterval(() => {
      if (eventSocket !== socket || socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ type: 'ping' }));
      } catch {
        closeEventChannel();
      }
    }, 20_000);
  };
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data));
      if (message?.type === 'pong') return;
      chrome.runtime.sendMessage({ type: 'native_event', event: message }).catch(() => undefined);
    } catch {
      // The event channel only accepts JSON messages.
    }
  };
  socket.onerror = () => {
    if (eventSocket === socket) closeEventChannel();
  };
  socket.onclose = () => {
    if (eventSocket === socket) closeEventChannel();
  };
}

const INLINE_ARTIFACT_LIMIT_BYTES = 256 * 1024;
const ARTIFACT_CHUNK_SIZE = 384 * 1024;

function redactArtifactText(value: string): string {
  return value
    .replace(
      /((?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[_-]?token|access[_-]?token|refresh[_-]?token|password)\s*[=:]\s*)("[^"]*"|'[^']*'|[^,;\s<]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
}

function base64Bytes(value: string): Uint8Array | undefined {
  const normalized = value.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return undefined;
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadLargeArtifact(
  request: NativeRequest,
  toolName: string,
  result: unknown,
  signal: AbortSignal,
): Promise<Record<string, unknown> | undefined> {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
  const text = Array.isArray(content)
    ? content.find((item) => item?.type === 'text' && typeof item.text === 'string')?.text
    : undefined;
  let parsed: any;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Keep the original text as a text artifact.
    }
  }

  const binaryValue =
    (typeof parsed?.base64Data === 'string' && parsed.base64Data) ||
    (typeof parsed?.base64 === 'string' && parsed.base64) ||
    (typeof (result as any)?.base64Data === 'string' && (result as any).base64Data) ||
    (parsed?.base64Encoded === true && typeof parsed?.responseBody === 'string'
      ? parsed.responseBody
      : undefined);
  const binary = binaryValue ? base64Bytes(binaryValue) : undefined;
  const contentType =
    (typeof parsed?.mimeType === 'string' && parsed.mimeType) ||
    (typeof parsed?.contentType === 'string' && parsed.contentType) ||
    (toolName.includes('screenshot')
      ? 'image/png'
      : toolName.includes('pdf')
        ? 'application/pdf'
        : undefined);
  const bytes =
    binary && contentType
      ? binary
      : new TextEncoder().encode(
          redactArtifactText(
            typeof result === 'string' ? result : (JSON.stringify(result) ?? String(result)),
          ),
        );
  if (bytes.byteLength <= INLINE_ARTIFACT_LIMIT_BYTES) return undefined;

  const artifactId = crypto.randomUUID();
  const digest = await sha256(bytes);
  for (
    let offset = 0, seq = 0;
    offset < bytes.byteLength;
    offset += ARTIFACT_CHUNK_SIZE, seq += 1
  ) {
    if (signal.aborted || !nativePort) throw new Error('Artifact upload canceled');
    const chunk = bytes.slice(offset, Math.min(offset + ARTIFACT_CHUNK_SIZE, bytes.byteLength));
    nativePort.postMessage({
      version: NATIVE_PROTOCOL_VERSION,
      type: 'artifact',
      requestId: request.requestId,
      traceId: request.traceId,
      artifactId,
      contentType: contentType || (toolName.includes('html') ? 'text/html' : 'application/json'),
      size: bytes.byteLength,
      sha256: digest,
      seq,
      eof: offset + chunk.byteLength === bytes.byteLength,
      data: bytesToBase64(chunk),
    });
  }
  return {
    type: 'artifact',
    artifactId,
    contentType: contentType || (toolName.includes('html') ? 'text/html' : 'application/json'),
    size: bytes.byteLength,
    sha256: digest,
  };
}

async function handleProtocolRequest(message: NativeRequest): Promise<void> {
  if (respondedProtocolRequests.has(message.requestId) || activeToolCalls.has(message.requestId))
    return;
  if (message.deadlineAt <= Date.now()) {
    postProtocolResponseOnce(
      message,
      protocolErrorResponse(message, 'DEADLINE_EXCEEDED', 'Request deadline exceeded'),
    );
    return;
  }

  const controller = new AbortController();
  activeToolCalls.set(message.requestId, controller);
  const remainingMs = Math.max(1, message.deadlineAt - Date.now());
  let deadlineExpired = false;
  const deadlineTimer = setTimeout(() => {
    deadlineExpired = true;
    controller.abort();
  }, remainingMs);
  try {
    let result: unknown;
    switch (message.method) {
      case 'browser.callTool': {
        const toolResult = await handleCallTool(
          message.params as any,
          controller.signal,
          (progress) => {
            if (controller.signal.aborted) return;
            nativePort?.postMessage({
              version: NATIVE_PROTOCOL_VERSION,
              type: 'event',
              requestId: message.requestId,
              traceId: message.traceId,
              event: 'tool.progress',
              data: progress,
            });
          },
        );
        result = {
          status: 'success',
          message: SUCCESS_MESSAGES.TOOL_EXECUTED,
          data: toolResult,
        };
        break;
      }
      case 'browser.processData':
        result = {
          status: 'success',
          message: SUCCESS_MESSAGES.TOOL_EXECUTED,
          data: message.params,
        };
        break;
      case 'rr.listPublishedFlows': {
        const published = await listFlows();
        const items = [] as any[];
        for (const p of published) {
          const flow = await getFlow(p.id);
          if (!flow) continue;
          items.push({
            id: p.id,
            slug: p.id,
            version: p.schemaVersion,
            name: p.name,
            description: p.description || flow.description || '',
            variables: flow.variables || [],
            meta: flow.meta || {},
          });
        }
        result = { status: 'success', items };
        break;
      }
      case 'rr.runFlow': {
        const { flowId, args } = (message.params || {}) as any;
        if (typeof flowId !== 'string' || !flowId) throw new Error('flowId is required');
        if (!(await getFlow(flowId))) throw new Error(`Flow not found: ${flowId}`);
        const run = await enqueueFlow(flowId, args);
        result = {
          status: 'success',
          data: { content: [{ type: 'text', text: JSON.stringify(run) }], isError: false },
        };
        break;
      }
      default:
        postProtocolResponseOnce(
          message,
          protocolErrorResponse(
            message,
            'EXECUTION_UNKNOWN',
            `Unsupported method: ${message.method}`,
          ),
        );
        return;
    }
    if (controller.signal.aborted) {
      postProtocolResponseOnce(
        message,
        protocolErrorResponse(
          message,
          deadlineExpired ? 'DEADLINE_EXCEEDED' : 'CANCELED',
          deadlineExpired ? 'Request deadline exceeded' : 'Request canceled',
        ),
      );
    } else {
      const artifact = await uploadLargeArtifact(
        message,
        String((message.params as any)?.name || message.method),
        result,
        controller.signal,
      );
      postProtocolResponseOnce(message, {
        version: NATIVE_PROTOCOL_VERSION,
        type: 'response',
        requestId: message.requestId,
        traceId: message.traceId,
        ok: true,
        result: artifact || result,
      });
    }
  } catch (error) {
    const code = controller.signal.aborted
      ? deadlineExpired
        ? 'DEADLINE_EXCEEDED'
        : 'CANCELED'
      : 'BROWSER_ERROR';
    postProtocolResponseOnce(
      message,
      protocolErrorResponse(message, code, error instanceof Error ? error.message : String(error)),
    );
  } finally {
    clearTimeout(deadlineTimer);
    activeToolCalls.delete(message.requestId);
  }
}

// ==================== Keepalive Management ====================

/**
 * Sync keepalive hold based on autoConnectEnabled state.
 * When auto-connect is enabled, we hold a keepalive reference to keep SW alive.
 */
function syncKeepaliveHold(): void {
  if (autoConnectEnabled) {
    if (!keepaliveRelease) {
      keepaliveRelease = acquireKeepalive('native-host');
      console.debug(`${LOG_PREFIX} Acquired keepalive`);
    }
    return;
  }
  if (keepaliveRelease) {
    try {
      keepaliveRelease();
      console.debug(`${LOG_PREFIX} Released keepalive`);
    } catch {
      // Ignore
    }
    keepaliveRelease = null;
  }
}

// ==================== Auto-connect Settings ====================

/**
 * Load the nativeAutoConnectEnabled setting from storage.
 */
async function loadNativeAutoConnectEnabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.NATIVE_AUTO_CONNECT_ENABLED]);
    const raw = result[STORAGE_KEYS.NATIVE_AUTO_CONNECT_ENABLED];
    if (typeof raw === 'boolean') return raw;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to load nativeAutoConnectEnabled`, error);
  }
  return true; // Default to enabled
}

/**
 * Set the nativeAutoConnectEnabled setting and persist to storage.
 */
async function setNativeAutoConnectEnabled(enabled: boolean): Promise<void> {
  autoConnectEnabled = enabled;
  autoConnectLoaded = true;
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.NATIVE_AUTO_CONNECT_ENABLED]: enabled });
    console.debug(`${LOG_PREFIX} Set nativeAutoConnectEnabled=${enabled}`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to persist nativeAutoConnectEnabled`, error);
  }
  syncKeepaliveHold();
}

// ==================== Port Preference ====================

/**
 * Get the preferred port for connecting to native server.
 * Priority: explicit override > user preference > last known port > default
 */
async function getPreferredPort(override?: unknown): Promise<number> {
  const explicit = normalizePort(override);
  if (explicit) return explicit;

  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.NATIVE_SERVER_PORT,
      STORAGE_KEYS.SERVER_STATUS,
    ]);

    const userPort = normalizePort(result[STORAGE_KEYS.NATIVE_SERVER_PORT]);
    if (userPort) return userPort;

    const status = result[STORAGE_KEYS.SERVER_STATUS] as Partial<ServerStatus> | undefined;
    const statusPort = normalizePort(status?.port);
    if (statusPort) return statusPort;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to read preferred port`, error);
  }

  const inMemoryPort = normalizePort(currentServerStatus.port);
  if (inMemoryPort) return inMemoryPort;

  return NATIVE_HOST.DEFAULT_PORT;
}

// ==================== Reconnect Scheduling ====================

/**
 * Schedule a reconnect attempt with exponential backoff.
 */
function scheduleReconnect(reason: string): void {
  if (nativePort) return;
  if (manualDisconnect) return;
  if (!autoConnectEnabled) return;
  if (reconnectTimer) return;

  setNativeConnectionState('degraded', reason);

  const delay = getReconnectDelayMs(reconnectAttempts);
  console.debug(
    `${LOG_PREFIX} Reconnect scheduled in ${delay}ms (attempt=${reconnectAttempts}, reason=${reason})`,
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (nativePort) return;
    if (manualDisconnect || !autoConnectEnabled) return;

    reconnectAttempts += 1;
    void ensureNativeConnected(`reconnect:${reason}`).catch(() => {});
  }, delay);
}

// ==================== Server Status Update ====================

/**
 * Mark server as stopped and broadcast the change.
 */
async function markServerStopped(reason: string): Promise<void> {
  currentServerStatus = {
    isRunning: false,
    port: currentServerStatus.port,
    lastUpdated: Date.now(),
  };
  try {
    await saveServerStatus(currentServerStatus);
  } catch {
    // Ignore
  }
  broadcastServerStatusChange(currentServerStatus);
  console.debug(`${LOG_PREFIX} Server marked stopped (${reason})`);
}

// ==================== Core Ensure Function ====================

/**
 * Ensure native connection is established.
 * This is the main entry point for auto-connect logic.
 *
 * @param trigger - Description of what triggered this call (for logging)
 * @param portOverride - Optional explicit port to use
 * @returns Whether the connection is now established
 */
async function ensureNativeConnected(trigger: string, portOverride?: unknown): Promise<boolean> {
  // Concurrency protection: only one ensure flow at a time
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    // Avoid a stale storage read overwriting native.serverStarted from a new host.
    await statusReady;

    // Load auto-connect setting if not yet loaded
    if (!autoConnectLoaded) {
      autoConnectEnabled = await loadNativeAutoConnectEnabled();
      autoConnectLoaded = true;
      syncKeepaliveHold();
    }

    // If auto-connect is disabled, do nothing
    if (!autoConnectEnabled) {
      setNativeConnectionState('stopped', 'auto_connect_disabled');
      console.debug(`${LOG_PREFIX} Auto-connect disabled, skipping ensure (trigger=${trigger})`);
      return false;
    }

    // Sync keepalive hold
    syncKeepaliveHold();

    // Already connected
    if (nativePort) {
      const ready = nativeConnectionState === 'ready';
      console.debug(`${LOG_PREFIX} Already connected (ready=${ready}, trigger=${trigger})`);
      return ready;
    }

    // Get the port to use
    const port = await getPreferredPort(portOverride);
    console.debug(`${LOG_PREFIX} Attempting connection on port ${port} (trigger=${trigger})`);

    // Attempt connection
    const ok = connectNativeHost(port);
    if (!ok) {
      console.warn(`${LOG_PREFIX} Connection failed (trigger=${trigger})`);
      scheduleReconnect(`connect_failed:${trigger}`);
      return false;
    }

    console.debug(`${LOG_PREFIX} Connection initiated successfully (trigger=${trigger})`);
    // Note: Don't reset reconnect state here. Wait for native.serverStarted confirmation.
    // Chrome may return a Port but disconnect immediately if native host is missing.
    return true;
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}

/**
 * Connect to the native messaging host
 * @returns Whether the connection was initiated successfully
 */
export function connectNativeHost(port: number = NATIVE_HOST.DEFAULT_PORT): boolean {
  if (nativePort) {
    return nativeConnectionState === 'ready';
  }

  try {
    setNativeConnectionState('starting');
    negotiatedVersion = undefined;
    nativeCapabilities = undefined;
    nativePort = chrome.runtime.connectNative(HOST_NAME);

    nativePort.onMessage.addListener(async (message) => {
      if (typeof message?.version === 'number') {
        let protocolMessage: NativeProtocolMessage;
        try {
          protocolMessage = parseNativeProtocolMessage(message);
        } catch (error) {
          console.warn(`${LOG_PREFIX} Invalid protocol message`, error);
          if (typeof message?.requestId === 'string' && typeof message?.traceId === 'string') {
            nativePort?.postMessage({
              version: NATIVE_PROTOCOL_VERSION,
              type: 'response',
              requestId: message.requestId,
              traceId: message.traceId,
              ok: false,
              error: {
                code: error instanceof NativeProtocolError ? error.code : 'INVALID_REQUEST',
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }
          return;
        }

        switch (protocolMessage.type) {
          case 'hello': {
            const selected =
              protocolMessage.selectedVersion ??
              negotiateNativeProtocolVersion(protocolMessage.supportedVersions);
            if (selected === null) {
              setNativeConnectionState('degraded', 'unsupported_protocol_version');
              console.warn(`${LOG_PREFIX} Native host has no compatible protocol version`);
              return;
            }
            setNativeConnectionState('connected');
            negotiatedVersion = selected;
            persistNativeConnectionState();
            if (!protocolMessage.selectedVersion) {
              nativePort?.postMessage({
                ...createNativeHello(
                  'extension-background',
                  { name: 'chrome-mcp-extension', version: '2' },
                  protocolMessage.traceId,
                ),
                selectedVersion: selected,
              });
            }
            nativePort?.postMessage(createNativeCapabilities(protocolMessage.traceId));
            return;
          }
          case 'capabilities':
            nativeCapabilities = {
              methods: [...protocolMessage.methods],
              events: [...protocolMessage.events],
              features: [...protocolMessage.features],
            };
            persistNativeConnectionState();
            setNativeConnectionState('ready');
            return;
          case 'ping':
            nativePort?.postMessage({
              version: NATIVE_PROTOCOL_VERSION,
              type: 'pong',
              nonce: protocolMessage.nonce,
              traceId: protocolMessage.traceId,
            });
            return;
          case 'cancel':
            activeToolCalls.get(protocolMessage.requestId)?.abort();
            return;
          case 'request':
            await handleProtocolRequest(protocolMessage);
            return;
          case 'event':
            if (protocolMessage.event === 'tool.progress' && protocolMessage.requestId) {
              // Progress is consumed by the native request callback; no local action is needed.
            } else if (protocolMessage.event === 'native.serverStarted') {
              const port = (protocolMessage.data as { port?: unknown } | undefined)?.port;
              currentServerStatus = {
                isRunning: true,
                port: normalizePort(port) ?? currentServerStatus.port,
                lastUpdated: Date.now(),
              };
              await saveServerStatus(currentServerStatus);
              broadcastServerStatusChange(currentServerStatus);
              resetReconnectState();
            } else if (protocolMessage.event === 'native.serverStopped') {
              await markServerStopped('native_protocol_event');
            } else if (protocolMessage.event === 'native.eventChannelReady') {
              connectEventChannel(protocolMessage.data);
            }
            return;
          case 'pong':
            return;
          case 'response':
            if (forwardedFileRequests.delete(protocolMessage.requestId)) {
              chrome.runtime
                .sendMessage(
                  protocolMessage.ok
                    ? {
                        type: 'native_file_operation_response',
                        requestId: protocolMessage.requestId,
                        ok: true,
                        result: protocolMessage.result,
                      }
                    : {
                        type: 'native_file_operation_response',
                        requestId: protocolMessage.requestId,
                        ok: false,
                        error: protocolMessage.error?.message || 'File operation failed',
                      },
                )
                .catch(() => undefined);
            }
            return;
        }
      }

      return;
    });

    nativePort.onDisconnect.addListener(() => {
      console.warn(ERROR_MESSAGES.NATIVE_DISCONNECTED, chrome.runtime.lastError);
      for (const controller of activeToolCalls.values()) controller.abort();
      activeToolCalls.clear();
      for (const requestId of forwardedFileRequests) {
        chrome.runtime
          .sendMessage({
            type: 'native_file_operation_response',
            requestId,
            ok: false,
            error: 'Native host disconnected before the file operation completed',
          })
          .catch(() => undefined);
      }
      forwardedFileRequests.clear();
      closeEventChannel();
      nativePort = null;

      // Mark server as stopped since native host disconnection means server is down
      void markServerStopped('native_port_disconnected');

      // Handle reconnection based on disconnect reason
      if (manualDisconnect) {
        manualDisconnect = false;
        setNativeConnectionState('stopped', 'manual_disconnect');
        return;
      }
      if (!autoConnectEnabled) {
        setNativeConnectionState('stopped', 'auto_connect_disabled');
        return;
      }
      setNativeConnectionState('degraded', 'native_port_disconnected');
      scheduleReconnect('native_port_disconnected');
    });

    nativePort.postMessage(
      createNativeHello('extension-background', { name: 'chrome-mcp-extension', version: '2' }),
    );
    nativePort.postMessage({
      version: NATIVE_PROTOCOL_VERSION,
      type: 'request',
      requestId: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
      method: 'native.start',
      deadlineAt: Date.now() + 15_000,
      params: { port },
    });
    // Note: Don't reset reconnect state here. Wait for native.serverStarted confirmation.
    // Chrome may return a Port but disconnect immediately if native host is missing.
    return true;
  } catch (error) {
    console.warn(ERROR_MESSAGES.NATIVE_CONNECTION_FAILED, error);
    nativePort = null;
    setNativeConnectionState('degraded', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Initialize native host listeners and load initial state
 */
export const initNativeHostListener = () => {
  // Initialize server status from storage
  statusReady = Promise.all([loadServerStatus(), loadNativeConnectionState()])
    .then(([status]) => {
      currentServerStatus = status;
    })
    .catch((error) => {
      console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
    });

  // Auto-connect on SW activation (covers SW restart after idle termination)
  void ensureNativeConnected('sw_startup').catch(() => {});

  // Auto-connect on Chrome browser startup
  chrome.runtime.onStartup.addListener(() => {
    void ensureNativeConnected('onStartup').catch(() => {});
  });

  // Auto-connect on extension install/update
  chrome.runtime.onInstalled.addListener(() => {
    void ensureNativeConnected('onInstalled').catch(() => {});
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Allow UI to call tools directly
    if (message && message.type === 'call_tool' && message.name) {
      handleCallTool({ name: message.name, args: message.args })
        .then((res) => sendResponse({ success: true, result: res }))
        .catch((err) =>
          sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }),
        );
      return true;
    }

    const msgType = typeof message === 'string' ? message : message?.type;

    // ENSURE_NATIVE: Trigger ensure without changing autoConnectEnabled
    if (msgType === NativeMessageType.ENSURE_NATIVE) {
      const portOverride = typeof message === 'object' ? message.port : undefined;
      ensureNativeConnected('ui_ensure', portOverride)
        .then((connected) => {
          sendResponse({
            success: true,
            connected,
            state: nativeConnectionState,
            autoConnectEnabled,
          });
        })
        .catch((e) => {
          sendResponse({
            success: false,
            connected: nativePort !== null,
            state: nativeConnectionState,
            error: String(e),
          });
        });
      return true;
    }

    // CONNECT_NATIVE: Explicit user connect, re-enables auto-connect
    if (msgType === NativeMessageType.CONNECT_NATIVE) {
      const portOverride = typeof message === 'object' ? message.port : undefined;
      const normalized = normalizePort(portOverride);

      (async () => {
        // Explicit user connect: re-enable auto-connect
        await setNativeAutoConnectEnabled(true);

        if (normalized) {
          // Best-effort: persist preferred port
          try {
            await chrome.storage.local.set({ [STORAGE_KEYS.NATIVE_SERVER_PORT]: normalized });
          } catch {
            // Ignore
          }
        }

        return ensureNativeConnected('ui_connect', normalized ?? undefined);
      })()
        .then((connected) => {
          sendResponse({ success: true, connected, state: nativeConnectionState });
        })
        .catch((e) => {
          sendResponse({
            success: false,
            connected: nativePort !== null,
            state: nativeConnectionState,
            error: String(e),
          });
        });
      return true;
    }

    if (msgType === NativeMessageType.PING_NATIVE) {
      const connected = nativePort !== null;
      sendResponse({ connected, state: nativeConnectionState, autoConnectEnabled });
      return true;
    }

    // DISCONNECT_NATIVE: Explicit user disconnect, disables auto-connect
    if (msgType === NativeMessageType.DISCONNECT_NATIVE) {
      (async () => {
        // Explicit user disconnect: disable auto-connect and stop reconnect loop
        await setNativeAutoConnectEnabled(false);
        clearReconnectTimer();
        reconnectAttempts = 0;
        syncKeepaliveHold();

        if (nativePort) {
          // Only set manualDisconnect if we actually have a port to disconnect.
          // This prevents the flag from persisting when there's no active connection.
          manualDisconnect = true;
          try {
            nativePort.disconnect();
          } catch {
            // Ignore
          }
          nativePort = null;
        }
        setNativeConnectionState('stopped', 'manual_disconnect');
        await markServerStopped('manual_disconnect');
      })()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((e) => {
          sendResponse({ success: false, error: String(e) });
        });
      return true;
    }

    if (message.type === BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS) {
      sendResponse({
        success: true,
        serverStatus: currentServerStatus,
        connected: nativePort !== null,
        state: nativeConnectionState,
      });
      return true;
    }

    if (message.type === BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS) {
      loadServerStatus()
        .then((storedStatus) => {
          currentServerStatus = storedStatus;
          sendResponse({
            success: true,
            serverStatus: currentServerStatus,
            connected: nativePort !== null,
            state: nativeConnectionState,
          });
        })
        .catch((error) => {
          console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
          sendResponse({
            success: false,
            error: ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED,
            serverStatus: currentServerStatus,
            connected: nativePort !== null,
            state: nativeConnectionState,
          });
        });
      return true;
    }

    if (message.type === BACKGROUND_MESSAGE_TYPES.START_NATIVE_SERVER) {
      const portOverride = typeof message === 'object' ? message.port : undefined;
      ensureNativeConnected('ui_start', portOverride)
        .then((connected) => {
          if (!connected || !nativePort) {
            sendResponse({ success: false, connected: false, error: 'Native host not connected' });
            return;
          }
          nativePort.postMessage({
            version: NATIVE_PROTOCOL_VERSION,
            type: 'request',
            requestId: crypto.randomUUID(),
            traceId: crypto.randomUUID(),
            method: 'native.start',
            deadlineAt: Date.now() + 15_000,
            params: { port: portOverride },
          });
          sendResponse({ success: true, connected: true });
        })
        .catch((e) =>
          sendResponse({ success: false, connected: nativePort !== null, error: String(e) }),
        );
      return true;
    }

    // Forward file operation messages to native host
    if (message.type === 'forward_to_native' && message.request) {
      if (nativePort) {
        const requestId =
          typeof message.request.requestId === 'string'
            ? message.request.requestId
            : crypto.randomUUID();
        forwardedFileRequests.add(requestId);
        nativePort.postMessage({
          version: NATIVE_PROTOCOL_VERSION,
          type: 'request',
          requestId,
          traceId: crypto.randomUUID(),
          method: 'file.operation',
          deadlineAt: Date.now() + 30_000,
          params: message.request.params,
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Native host not connected' });
      }
      return true;
    }
  });
};
