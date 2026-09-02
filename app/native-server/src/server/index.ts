/**
 * HTTP Server - Core server implementation.
 *
 * Responsibilities:
 * - Fastify instance management
 * - Plugin registration (CORS, etc.)
 * - Route delegation to specialized modules
 * - MCP transport handling
 * - Server lifecycle management
 */
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import {
  NATIVE_SERVER_PORT,
  TIMEOUTS,
  SERVER_CONFIG,
  HTTP_STATUS,
  ERROR_MESSAGES,
  isAllowedCorsOrigin,
  MCP_API_KEY_ENV,
} from '../constant';
import { NativeMessagingHost } from '../native-messaging-host';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { getMcpServer } from '../mcp/mcp-server';
import { getModernMcpServer } from '../mcp/mcp-server-modern.js';
import { getLegacyMcpServer } from '../mcp/mcp-server-legacy.js';
import { AgentStreamManager } from '../agent/stream-manager';
import { AgentChatService } from '../agent/chat-service';
import { CodexEngine } from '../agent/engines/codex';
import { ClaudeEngine } from '../agent/engines/claude';
import { DeepSeekEngine } from '../agent/engines/deepseek';
import { closeDb } from '../agent/db';
import { registerAgentRoutes } from './routes';
import { TOOL_SCHEMAS } from '@ethanwilkins/chrome-mcp-shared-2026';
import packageJson from '../../package.json';
import { getRecentToolCalls } from '../mcp/register-tools';
import { NativeMessageType } from '@ethanwilkins/chrome-mcp-shared-2026';
import { browserProfileManager } from '../browser-profile-manager.js';

// ============================================================
// Types
// ============================================================

interface ExtensionRequestPayload {
  data?: unknown;
}

type McpTransport = StreamableHTTPServerTransport | SSEServerTransport;
type McpTransportType = 'streamable-http' | 'sse' | 'stdio';
type McpEndpoint = '/mcp' | '/sse';
const STDIO_MCP_ORIGIN = 'chrome-extension://mcp-stdio';

interface McpClientInfo {
  name: string;
  version: string;
}

interface McpSessionMetadata {
  transportType: McpTransportType;
  endpoint: McpEndpoint;
  clientInfo?: McpClientInfo | null;
  remoteAddress?: string | null;
  userAgent?: string | null;
}

interface McpSession {
  transport: McpTransport;
  transportType: McpTransportType;
  endpoint: McpEndpoint;
  clientInfo: McpClientInfo | null;
  remoteAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  activeRequests: number;
  requestCount: number;
  totalRequestLatencyMs: number;
  lastRequestLatencyMs: number | null;
  maxRequestLatencyMs: number | null;
  latencySamplesMs: number[];
  errorCount: number;
  lastError: string | null;
}

interface StatelessMcpStats {
  activeRequests: number;
  requestCount: number;
  lastRequestAt: Date | null;
  lastRequestLatencyMs: number | null;
  clientInfo: McpClientInfo | null;
  remoteAddress: string | null;
  userAgent: string | null;
  errorCount: number;
}
const SESSION_TTL_MS = 10 * 60_000;

function percentile(values: number[], ratio: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? null;
}

function getMcpClientInfo(body: unknown): McpClientInfo | null {
  if (!body || typeof body !== 'object') return null;

  const params =
    'params' in body && body.params && typeof body.params === 'object' ? body.params : null;
  const directClientInfo =
    params && 'clientInfo' in params && params.clientInfo && typeof params.clientInfo === 'object'
      ? params.clientInfo
      : null;
  const meta =
    params && '_meta' in params && params._meta && typeof params._meta === 'object'
      ? params._meta
      : null;
  const modernClientInfo =
    meta &&
    'io.modelcontextprotocol/clientInfo' in meta &&
    meta['io.modelcontextprotocol/clientInfo'] &&
    typeof meta['io.modelcontextprotocol/clientInfo'] === 'object'
      ? meta['io.modelcontextprotocol/clientInfo']
      : null;
  const clientInfo = directClientInfo ?? modernClientInfo;
  if (!clientInfo) return null;

  const name =
    'name' in clientInfo && typeof clientInfo.name === 'string' ? clientInfo.name.trim() : '';
  const version =
    'version' in clientInfo && typeof clientInfo.version === 'string'
      ? clientInfo.version.trim()
      : '';
  if (!name && !version) return null;

  return {
    name: name || 'Unknown client',
    version: version || 'Unknown version',
  };
}

// ============================================================
// Server Class
// ============================================================

export class Server {
  private fastify: FastifyInstance;
  public isRunning = false;
  /** Keep the control plane alive while the Chrome-facing service is paused. */
  public serviceEnabled = false;
  private nativeHost: NativeMessagingHost | null = null;
  private transportsMap = new Map<string, McpSession>();
  private readonly statelessMcpStats: StatelessMcpStats = {
    activeRequests: 0,
    requestCount: 0,
    lastRequestAt: null,
    lastRequestLatencyMs: null,
    clientInfo: null,
    remoteAddress: null,
    userAgent: null,
    errorCount: 0,
  };
  private startedAt = Date.now();
  private reclaimedSessions = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private takeoverRequested = false;
  private agentStreamManager: AgentStreamManager;
  private agentChatService: AgentChatService;
  /** Streamable HTTP（尝鲜版）：MCP 2026-07-28, stateless and strict. */
  private readonly modernMcpHandler = createMcpHandler(() => getModernMcpServer(), {
    legacy: 'reject',
    keepAliveMs: 15_000,
  });
  private readonly modernMcpNodeHandler = toNodeHandler(this.modernMcpHandler);

  constructor() {
    this.fastify = Fastify({
      logger: SERVER_CONFIG.LOGGER_ENABLED,
      // Give clients that reuse an HTTP connection enough time between calls.
      keepAliveTimeout: 60_000,
      connectionTimeout: 0,
    });
    this.agentStreamManager = new AgentStreamManager();
    this.agentChatService = new AgentChatService({
      engines: [new CodexEngine(), new ClaudeEngine(), new DeepSeekEngine()],
      streamManager: this.agentStreamManager,
    });
    this.setupPlugins();
    this.setupMcpAuth();
    this.setupRoutes();
  }

  /**
   * Associate NativeMessagingHost instance.
   */
  public setNativeHost(nativeHost: NativeMessagingHost): void {
    this.nativeHost = nativeHost;
  }

  private async setupPlugins(): Promise<void> {
    await this.fastify.register(cors, {
      origin: (origin, cb) => {
        // Allow requests with no origin (e.g., curl, server-to-server)
        if (!origin) {
          return cb(null, true);
        }
        cb(null, isAllowedCorsOrigin(origin));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    });
  }

  private setupRoutes(): void {
    // Health check
    this.setupHealthRoutes();

    this.setupServiceGate();

    // Extension communication
    this.setupExtensionRoutes();

    // Agent routes (delegated to separate module)
    registerAgentRoutes(this.fastify, {
      streamManager: this.agentStreamManager,
      chatService: this.agentChatService,
    });

    // MCP routes
    this.setupMcpRoutes();
  }

  private setupServiceGate(): void {
    this.fastify.addHook('onRequest', async (request, reply) => {
      const pathname = (request.raw.url ?? '').split('?')[0];
      if (!['/mcp', '/mcp-new', '/sse', '/messages', '/ask-extension'].includes(pathname)) return;
      if (this.serviceEnabled) return;
      reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE).send({
        error: 'Chrome MCP Bridge 服务当前已停止，请先在客户端中启动服务。',
      });
    });
  }

  /**
   * Protect MCP transports when an API key is configured. Local installs with
   * no key remain backwards compatible.
   */
  private setupMcpAuth(): void {
    this.fastify.addHook('onRequest', async (request, reply) => {
      const pathname = (request.raw.url ?? '').split('?')[0];
      if (!['/mcp', '/mcp-new', '/sse', '/messages'].includes(pathname)) return;

      const expectedKey = process.env[MCP_API_KEY_ENV]?.trim();
      const origin = request.headers.origin;
      if (origin && !isAllowedCorsOrigin(origin)) {
        reply.status(HTTP_STATUS.FORBIDDEN).send({ error: ERROR_MESSAGES.ORIGIN_NOT_ALLOWED });
        return;
      }
      if (!origin && !expectedKey) {
        reply.status(HTTP_STATUS.FORBIDDEN).send({ error: ERROR_MESSAGES.ORIGIN_NOT_ALLOWED });
        return;
      }
      // Browsers do not send Authorization on CORS preflight requests; the
      // actual MCP request is authenticated below.
      if (request.method === 'OPTIONS') return;
      if (!expectedKey) return;

      const authorization = request.headers.authorization;
      const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
      const providedKey = bearer ?? request.headers['x-api-key'];
      if (typeof providedKey !== 'string' || providedKey !== expectedKey) {
        reply.status(HTTP_STATUS.UNAUTHORIZED).send({ error: ERROR_MESSAGES.UNAUTHORIZED });
      }
    });
  }

  // ============================================================
  // Health Routes
  // ============================================================

  private setupHealthRoutes(): void {
    this.fastify.get('/ping', async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.status(HTTP_STATUS.OK).send({
        status: 'ok',
        message: 'pong',
      });
    });
    this.fastify.get(
      '/status',
      async (request: FastifyRequest<{ Querystring: { probe?: string } }>, reply: FastifyReply) => {
        const sessions = [...this.transportsMap.values()];
        let probe: Record<string, unknown> | undefined;
        if (request.query.probe === '1' && this.serviceEnabled) {
          const startedAt = Date.now();
          try {
            const response = await this.nativeHost?.sendRequestToExtensionAndWait(
              { name: 'chrome_get_tab_url', args: {} },
              NativeMessageType.CALL_TOOL,
              3_000,
            );
            probe = { ok: response?.status === 'success', elapsedMs: Date.now() - startedAt };
          } catch (error) {
            probe = { ok: false, elapsedMs: Date.now() - startedAt, error: String(error) };
          }
        }
        return reply.status(HTTP_STATUS.OK).send({
          server: {
            version: packageJson.version,
            running: this.isRunning,
            serviceRunning: this.serviceEnabled,
            uptimeMs: Date.now() - this.startedAt,
          },
          packages: {
            'mcp-chrome-bridge-2026': packageJson.version,
          },
          mcp: {
            activeSessions: sessions.length,
            activeRequests: sessions.reduce((total, session) => total + session.activeRequests, 0),
            reclaimedSessions: this.reclaimedSessions,
            streamableHttp: true,
            clients: [...this.transportsMap.entries()].map(([sessionId, session]) => ({
              sessionId,
              clientInfo: session.clientInfo,
              transport: session.transportType,
              endpoint: session.endpoint,
              remoteAddress: session.remoteAddress,
              userAgent: session.userAgent,
              createdAt: session.createdAt.toISOString(),
              lastActivityAt: session.lastActivityAt.toISOString(),
              activeRequests: session.activeRequests,
              requestCount: session.requestCount,
              lastRequestLatencyMs: session.lastRequestLatencyMs,
              p95RequestLatencyMs: percentile(session.latencySamplesMs, 0.95),
              averageRequestLatencyMs: session.requestCount
                ? Math.round(session.totalRequestLatencyMs / session.requestCount)
                : null,
              maxRequestLatencyMs: session.maxRequestLatencyMs,
              errorCount: session.errorCount,
              lastError: session.lastError,
            })),
            stateless: {
              endpoint: '/mcp-new',
              transport: 'streamable-http',
              activeRequests: this.statelessMcpStats.activeRequests,
              requestCount: this.statelessMcpStats.requestCount,
              lastRequestAt: this.statelessMcpStats.lastRequestAt?.toISOString() ?? null,
              lastRequestLatencyMs: this.statelessMcpStats.lastRequestLatencyMs,
              clientInfo: this.statelessMcpStats.clientInfo,
              remoteAddress: this.statelessMcpStats.remoteAddress,
              userAgent: this.statelessMcpStats.userAgent,
              errorCount: this.statelessMcpStats.errorCount,
            },
          },
          extension: this.nativeHost?.getStatus() ?? null,
          nativeHost: this.nativeHost?.getStatus() ?? null,
          tools: { count: TOOL_SCHEMAS.length },
          browserProfiles: await browserProfileManager.summary(),
          recentToolCalls: getRecentToolCalls(),
          ...(probe ? { probe } : {}),
        });
      },
    );

    this.fastify.post('/__chrome_mcp_bridge/start', async (_request, reply) => {
      if (!this.nativeHost) {
        return reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE).send({
          status: 'not_available',
          message: 'Chrome Native Host 尚未连接。请确认扩展已加载并重载。',
        });
      }
      try {
        await this.nativeHost.startService();
        return reply.status(HTTP_STATUS.OK).send({ status: 'started' });
      } catch (error) {
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.fastify.post('/__chrome_mcp_bridge/stop', async (_request, reply) => {
      if (!this.nativeHost) {
        return reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE).send({
          status: 'not_available',
          message: 'Chrome Native Host 尚未连接。',
        });
      }
      try {
        await this.nativeHost.stopService();
        return reply.status(HTTP_STATUS.OK).send({ status: 'stopped' });
      } catch (error) {
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // A user may have opened the EXE before Chrome launches the Native
    // Messaging host. The latter must be able to take over the HTTP port so
    // the MCP server and the extension connection live in the same process.
    this.fastify.post('/__chrome_mcp_bridge/takeover', async (_request, reply) => {
      if (!this.isRunning || this.takeoverRequested) {
        return reply.status(404).send({ status: 'not_available' });
      }
      this.takeoverRequested = true;
      reply.status(HTTP_STATUS.OK).send({ status: 'stopping' });
      const stop = () => {
        void this.stop().finally(() => process.exit(0));
      };
      setTimeout(stop, 100).unref();
    });
  }

  private addSession(
    sessionId: string,
    transport: McpTransport,
    metadata: McpSessionMetadata,
  ): void {
    this.transportsMap.set(sessionId, {
      transport,
      transportType: metadata.transportType,
      endpoint: metadata.endpoint,
      clientInfo: metadata.clientInfo ?? null,
      remoteAddress: metadata.remoteAddress ?? null,
      userAgent: metadata.userAgent ?? null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      activeRequests: 0,
      requestCount: 0,
      totalRequestLatencyMs: 0,
      lastRequestLatencyMs: null,
      maxRequestLatencyMs: null,
      latencySamplesMs: [],
      errorCount: 0,
      lastError: null,
    });
  }

  private recordRequestLatency(session: McpSession, startedAt: number): void {
    const latencyMs = Math.max(0, Date.now() - startedAt);
    session.requestCount++;
    session.totalRequestLatencyMs += latencyMs;
    session.lastRequestLatencyMs = latencyMs;
    session.latencySamplesMs.push(latencyMs);
    if (session.latencySamplesMs.length > 100) session.latencySamplesMs.shift();
    session.maxRequestLatencyMs = Math.max(session.maxRequestLatencyMs ?? 0, latencyMs);
  }

  private async cleanupStaleSessions(): Promise<void> {
    const now = Date.now();
    for (const [sessionId, session] of this.transportsMap) {
      if (session.activeRequests || now - session.lastActivityAt.getTime() < SESSION_TTL_MS)
        continue;
      this.transportsMap.delete(sessionId);
      this.reclaimedSessions++;
      await session.transport.close().catch(() => undefined);
    }
  }

  // ============================================================
  // Extension Routes
  // ============================================================

  private setupExtensionRoutes(): void {
    this.fastify.get(
      '/ask-extension',
      async (request: FastifyRequest<{ Body: ExtensionRequestPayload }>, reply: FastifyReply) => {
        if (!this.nativeHost) {
          return reply
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.NATIVE_HOST_NOT_AVAILABLE });
        }
        if (!this.isRunning) {
          return reply
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.SERVER_NOT_RUNNING });
        }

        try {
          const extensionResponse = await this.nativeHost.sendRequestToExtensionAndWait(
            request.query,
            'process_data',
            TIMEOUTS.EXTENSION_REQUEST_TIMEOUT,
          );
          return reply.status(HTTP_STATUS.OK).send({ status: 'success', data: extensionResponse });
        } catch (error: unknown) {
          const err = error as Error;
          if (err.message.includes('timed out')) {
            return reply
              .status(HTTP_STATUS.GATEWAY_TIMEOUT)
              .send({ status: 'error', message: ERROR_MESSAGES.REQUEST_TIMEOUT });
          } else {
            return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
              status: 'error',
              message: `Failed to get response from extension: ${err.message}`,
            });
          }
        }
      },
    );
  }

  // ============================================================
  // MCP Routes
  // ============================================================

  private setupMcpRoutes(): void {
    // SSE endpoint
    this.fastify.get('/sse', async (request, reply) => {
      try {
        reply.raw.writeHead(HTTP_STATUS.OK, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const transport = new SSEServerTransport('/messages', reply.raw);
        this.addSession(transport.sessionId, transport, {
          transportType: 'sse',
          endpoint: '/sse',
          remoteAddress: request.ip,
          userAgent: getHeaderValue(request.headers['user-agent']),
        });

        reply.raw.on('close', () => {
          this.transportsMap.delete(transport.sessionId);
        });

        const server = getLegacyMcpServer();
        await server.connect(transport);

        reply.raw.write(':\n\n');
      } catch (error) {
        if (!reply.sent) {
          reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
        }
      }
    });

    // SSE messages endpoint
    this.fastify.post('/messages', async (req, reply) => {
      try {
        const { sessionId } = req.query as { sessionId?: string };
        const session = this.transportsMap.get(sessionId || '');
        const transport = session?.transport as SSEServerTransport | undefined;
        if (!sessionId || !session || !transport) {
          reply.code(HTTP_STATUS.BAD_REQUEST).send('No transport found for sessionId');
          return;
        }

        session.lastActivityAt = new Date();
        session.clientInfo = getMcpClientInfo(req.body) ?? session.clientInfo;
        session.activeRequests++;
        const startedAt = Date.now();
        try {
          await transport.handlePostMessage(req.raw, reply.raw, req.body);
        } catch (error) {
          session.errorCount++;
          session.lastError = error instanceof Error ? error.message : String(error);
          throw error;
        } finally {
          session.activeRequests--;
          this.recordRequestLatency(session, startedAt);
        }
      } catch (error) {
        if (!reply.sent) {
          reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
        }
      }
    });

    // Existing stateful Streamable HTTP endpoint.
    this.fastify.post('/mcp', async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      let session = this.transportsMap.get(sessionId || '');
      let transport: StreamableHTTPServerTransport | undefined = session?.transport as
        StreamableHTTPServerTransport | undefined;
      const clientInfo = getMcpClientInfo(request.body);

      if (transport) {
        // Transport found, proceed
      } else if (!sessionId && isInitializeRequest(request.body)) {
        const newSessionId = randomUUID();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
          onsessioninitialized: (initializedSessionId) => {
            if (transport && initializedSessionId === newSessionId) {
              this.addSession(initializedSessionId, transport, {
                // The stdio proxy marks its internal HTTP hop with this origin.
                transportType:
                  request.headers.origin === STDIO_MCP_ORIGIN ? 'stdio' : 'streamable-http',
                endpoint: '/mcp',
                clientInfo,
                remoteAddress: request.ip,
                userAgent: getHeaderValue(request.headers['user-agent']),
              });
            }
          },
        });

        transport.onclose = () => {
          if (transport?.sessionId && this.transportsMap.get(transport.sessionId)) {
            this.transportsMap.delete(transport.sessionId);
          }
        };
        await getMcpServer().connect(transport);
      } else {
        reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_MCP_REQUEST });
        return;
      }

      session = this.transportsMap.get(transport.sessionId || sessionId || '');
      const trackedSession = Boolean(session);
      if (session) {
        session.clientInfo = clientInfo ?? session.clientInfo;
        session.lastActivityAt = new Date();
        session.activeRequests++;
      }
      const startedAt = Date.now();
      try {
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } catch (error) {
        if (session) {
          session.errorCount++;
          session.lastError = error instanceof Error ? error.message : String(error);
        }
        if (!reply.sent) {
          reply
            .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.MCP_REQUEST_PROCESSING_ERROR });
        }
      } finally {
        if (trackedSession && session) session.activeRequests--;
        const currentSession =
          session ?? this.transportsMap.get(transport.sessionId || sessionId || '');
        if (currentSession) this.recordRequestLatency(currentSession, startedAt);
      }
    });

    // Existing Streamable HTTP SSE stream.
    this.fastify.get('/mcp', async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      const session = sessionId ? this.transportsMap.get(sessionId) : undefined;
      const transport = session?.transport as StreamableHTTPServerTransport | undefined;

      if (!transport) {
        reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_SSE_SESSION });
        return;
      }

      try {
        if (session) session.lastActivityAt = new Date();
        await transport.handleRequest(request.raw, reply.raw);
        if (!reply.sent) {
          reply.hijack();
        }
      } catch (error) {
        if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      }

      request.socket.on('close', () => {
        request.log.info(`SSE client disconnected for session: ${sessionId}`);
      });
    });

    // Existing Streamable HTTP session deletion.
    this.fastify.delete('/mcp', async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      const session = sessionId ? this.transportsMap.get(sessionId) : undefined;
      const transport = session?.transport as StreamableHTTPServerTransport | undefined;

      if (!transport) {
        reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: ERROR_MESSAGES.INVALID_SESSION_ID });
        return;
      }

      try {
        await transport.handleRequest(request.raw, reply.raw);
        if (!reply.sent) {
          reply.code(HTTP_STATUS.NO_CONTENT).send();
        }
      } catch (error) {
        if (!reply.sent) {
          reply
            .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .send({ error: ERROR_MESSAGES.MCP_SESSION_DELETION_ERROR });
        }
      }
    });

    // Streamable HTTP（尝鲜版） handles POST, GET and DELETE on one endpoint.
    this.fastify.all('/mcp-new', async (request, reply) => {
      const stats = this.statelessMcpStats;
      const startedAt = Date.now();
      stats.activeRequests++;
      stats.requestCount++;
      stats.lastRequestAt = new Date();
      stats.clientInfo = getMcpClientInfo(request.body) ?? stats.clientInfo;
      stats.remoteAddress = request.ip;
      stats.userAgent = getHeaderValue(request.headers['user-agent']);
      try {
        await this.modernMcpNodeHandler(request.raw, reply.raw, request.body);
      } catch (error) {
        stats.errorCount++;
        throw error;
      } finally {
        stats.activeRequests--;
        stats.lastRequestLatencyMs = Math.max(0, Date.now() - startedAt);
      }
    });
  }

  // ============================================================
  // Server Lifecycle
  // ============================================================

  public async start(port = NATIVE_SERVER_PORT, nativeHost: NativeMessagingHost): Promise<void> {
    if (!this.nativeHost) {
      this.nativeHost = nativeHost;
    } else if (this.nativeHost !== nativeHost) {
      this.nativeHost = nativeHost;
    }

    if (this.isRunning) {
      await this.startService();
      return;
    }

    try {
      await this.fastify.listen({ port, host: SERVER_CONFIG.HOST });

      // Set port environment variables after successful listen for Chrome MCP URL resolution
      process.env.CHROME_MCP_PORT = String(port);
      process.env.MCP_HTTP_PORT = String(port);

      this.isRunning = true;
      this.serviceEnabled = true;
      this.startedAt = Date.now();
      this.cleanupTimer = setInterval(() => void this.cleanupStaleSessions(), 60_000);
      this.cleanupTimer.unref();
    } catch (err) {
      this.isRunning = false;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.stopService();
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      await this.fastify.close();
      this.isRunning = false;
      this.serviceEnabled = false;
    } catch (err) {
      this.isRunning = false;
      this.serviceEnabled = false;
      closeDb();
      throw err;
    }
  }

  public async startService(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Chrome MCP Bridge 控制服务尚未启动。');
    }
    this.serviceEnabled = true;
  }

  public async stopService(): Promise<void> {
    if (!this.isRunning) return;
    await browserProfileManager.stopAll();
    this.serviceEnabled = false;
    closeDb();
  }

  public getInstance(): FastifyInstance {
    return this.fastify;
  }
}

const serverInstance = new Server();
export default serverInstance;
