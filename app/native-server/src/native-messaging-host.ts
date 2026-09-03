import { stdin, stdout } from 'process';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import net from 'node:net';
import { Server } from './server';
import {
  NativeProtocolError,
  NATIVE_PROTOCOL_VERSION,
  createNativeCapabilities,
  createNativeErrorResponse,
  createNativeHello,
  createNativeResponse,
  negotiateNativeProtocolVersion,
  parseNativeProtocolMessage,
  type NativeProtocolMessage,
  type NativeRequest,
  type NativeResponse,
  type NativeConnectionState,
} from '@ethanwilkins/chrome-mcp-shared-2026';
import { NATIVE_SERVER_PORT, TIMEOUTS } from './constant';
import fileHandler from './file-handler';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  onProgress?: (payload: any) => void | Promise<void>;
  timeoutId: NodeJS.Timeout;
  traceId: string;
  method: string;
  sideEffect: boolean;
  settled: boolean;
}

export interface NativeHostStatus {
  connected: boolean;
  state: NativeConnectionState;
  pendingRequests: number;
  lastActivityAt: string | null;
  lastSuccessAt: string | null;
}

function resolveServerPort(requested?: unknown): number {
  const configured = process.env.CHROME_MCP_PORT || process.env.MCP_HTTP_PORT;
  if (configured) {
    const port = Number.parseInt(configured, 10);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
  }
  const port = typeof requested === 'number' ? requested : Number(requested);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : NATIVE_SERVER_PORT;
}

function isAddressInUse(error: any): boolean {
  return error?.code === 'EADDRINUSE' || String(error?.message || '').includes('EADDRINUSE');
}

function requestPortTakeover(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: '/__chrome_mcp_bridge/takeover',
        method: 'POST',
        headers: { Connection: 'close' },
        timeout: 2_000,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
    request.end();
  });
}

function waitForPortAvailable(port: number, timeoutMs = 8_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false;
    const retry = () => {
      if (settled) return;
      if (Date.now() >= deadline) {
        settled = true;
        reject(new Error(`等待端口 ${port} 释放超时。`));
        return;
      }
      setTimeout(attempt, 100);
    };
    const attempt = () => {
      if (settled) return;
      const probe = net.createServer();
      probe.once('listening', () => {
        probe.close(() => {
          if (settled) return;
          settled = true;
          resolve();
        });
      });
      probe.once('error', (error: any) => {
        probe.close();
        if (error?.code === 'EADDRINUSE') {
          retry();
          return;
        }
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      probe.listen({ host: '127.0.0.1', port });
    };
    attempt();
  });
}

export class NativeMessagingHost {
  private readonly standaloneMode = process.env.CHROME_MCP_STANDALONE === '1';
  private associatedServer: Server | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private connected = false;
  private connectionState: NativeConnectionState = 'stopped';
  private lastActivityAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private respondedProtocolRequests = new Set<string>();
  private activeProtocolRequests = new Set<string>();
  private activeProtocolControllers = new Map<string, AbortController>();
  private readonly maxDeduplicatedRequests = 4096;

  public getStatus(): NativeHostStatus {
    return {
      connected: this.connected,
      state: this.connectionState,
      pendingRequests: this.pendingRequests.size,
      lastActivityAt: this.lastActivityAt?.toISOString() ?? null,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
    };
  }

  public isExtensionConnected(): boolean {
    return this.connected;
  }

  public setServer(serverInstance: Server): void {
    this.associatedServer = serverInstance;
  }

  // Start the HTTP server as soon as the native host is connected. The
  // extension still sends START, but startup must not depend on that single
  // message arriving after a reconnect.
  public start(): void {
    try {
      // The process can be launched by Chrome before the extension has sent
      // its first message. Mark the session ready only after a valid message
      // arrives so callers do not wait for a request that cannot be delivered.
      this.connected = false;
      this.connectionState = 'starting';
      this.lastActivityAt = new Date();
      this.setupMessageHandling();
      void this.startServer(resolveServerPort(NATIVE_SERVER_PORT));
    } catch (error: any) {
      process.exit(1);
    }
  }

  private setupMessageHandling(): void {
    if (this.standaloneMode) return;

    let buffer = Buffer.alloc(0);
    let expectedLength = -1;
    const MAX_MESSAGES_PER_TICK = 100; // Safety guard to avoid long-running loops per readable tick
    const MAX_MESSAGE_SIZE_BYTES = 16 * 1024 * 1024; // 16MB upper bound for a single message

    const processAvailable = () => {
      let processed = 0;
      while (processed < MAX_MESSAGES_PER_TICK) {
        // Read length header when needed
        if (expectedLength === -1) {
          if (buffer.length < 4) break; // not enough for header
          expectedLength = buffer.readUInt32LE(0);
          buffer = buffer.slice(4);

          // Validate length header
          if (expectedLength <= 0 || expectedLength > MAX_MESSAGE_SIZE_BYTES) {
            this.sendError(`Invalid message length: ${expectedLength}`);
            // Reset state to resynchronize stream
            expectedLength = -1;
            buffer = Buffer.alloc(0);
            break;
          }
        }

        // Wait for complete body
        if (buffer.length < expectedLength) break;

        const messageBuffer = buffer.slice(0, expectedLength);
        buffer = buffer.slice(expectedLength);
        expectedLength = -1;
        processed++;

        try {
          const message = JSON.parse(messageBuffer.toString());
          this.handleMessage(message);
        } catch (error: any) {
          this.sendError(`Failed to parse message: ${error.message}`);
        }
      }

      // If we hit the cap but still have at least one complete message pending, schedule to continue soon
      if (processed === MAX_MESSAGES_PER_TICK) {
        setImmediate(processAvailable);
      }
    };

    stdin.on('readable', () => {
      let chunk;
      while ((chunk = stdin.read()) !== null) {
        buffer = Buffer.concat([buffer, chunk]);
        processAvailable();
      }
    });

    stdin.on('end', () => {
      this.cleanup();
    });

    stdin.on('error', () => {
      this.cleanup();
    });
  }

  private async handleMessage(message: any): Promise<void> {
    this.lastActivityAt = new Date();
    if (!message || typeof message !== 'object') {
      this.sendError('Invalid message format');
      return;
    }
    try {
      await this.handleProtocolMessage(parseNativeProtocolMessage(message));
    } catch (error) {
      const protocolError =
        error instanceof NativeProtocolError
          ? error
          : new NativeProtocolError(
              'INVALID_REQUEST',
              error instanceof Error ? error.message : String(error),
            );
      if (typeof message.requestId === 'string' && typeof message.traceId === 'string') {
        this.sendMessage({
          version: NATIVE_PROTOCOL_VERSION,
          type: 'response',
          requestId: message.requestId,
          traceId: message.traceId,
          ok: false,
          error: { code: protocolError.code, message: protocolError.message },
        });
      } else {
        this.sendError(protocolError.message, protocolError.code);
      }
    }
  }

  private async handleProtocolMessage(message: NativeProtocolMessage): Promise<void> {
    this.connected = true;
    if (this.connectionState === 'starting' || this.connectionState === 'stopped') {
      this.connectionState = 'connected';
    }

    switch (message.type) {
      case 'hello': {
        const selectedVersion = negotiateNativeProtocolVersion(message.supportedVersions);
        if (selectedVersion === null) {
          throw new NativeProtocolError(
            'UNSUPPORTED_VERSION',
            'No mutually supported protocol version',
          );
        }
        this.sendMessage({
          ...createNativeHello(
            'native-service',
            { name: 'chrome-mcp-native', version: '2' },
            message.traceId,
          ),
          selectedVersion,
        });
        this.sendMessage(createNativeCapabilities(message.traceId));
        this.connectionState = 'ready';
        return;
      }
      case 'ping':
        this.sendMessage({
          version: NATIVE_PROTOCOL_VERSION,
          type: 'pong',
          nonce: message.nonce,
          traceId: message.traceId,
        });
        return;
      case 'pong':
      case 'capabilities':
      case 'event':
        if (message.type === 'event' && message.requestId) {
          this.pendingRequests.get(message.requestId)?.onProgress?.(message.data);
        }
        return;
      case 'cancel':
        {
          this.activeProtocolControllers.get(message.requestId)?.abort();
          const pending = this.pendingRequests.get(message.requestId);
          if (pending && !pending.settled) {
            clearTimeout(pending.timeoutId);
            pending.settled = true;
            this.pendingRequests.delete(message.requestId);
            pending.reject(
              new NativeProtocolError('CANCELED', message.reason || 'Request canceled'),
            );
          }
        }
        return;
      case 'response':
        this.resolveProtocolResponse(message);
        return;
      case 'request':
        await this.handleProtocolRequest(message);
        return;
    }
  }

  private resolveProtocolResponse(message: NativeResponse): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending || pending.settled || pending.traceId !== message.traceId) return;
    clearTimeout(pending.timeoutId);
    pending.settled = true;
    this.pendingRequests.delete(message.requestId);
    if (message.ok) {
      pending.resolve(message.result);
      this.lastSuccessAt = new Date();
    } else {
      const error = message.error!;
      pending.reject(new NativeProtocolError(error.code, error.message, error.details));
    }
  }

  private async handleProtocolRequest(message: NativeRequest): Promise<void> {
    if (
      this.respondedProtocolRequests.has(message.requestId) ||
      this.activeProtocolRequests.has(message.requestId)
    )
      return;
    this.activeProtocolRequests.add(message.requestId);
    const controller = new AbortController();
    this.activeProtocolControllers.set(message.requestId, controller);
    const deadlineTimer = setTimeout(
      () => controller.abort(),
      Math.max(1, message.deadlineAt - Date.now()),
    );
    if (message.deadlineAt <= Date.now()) {
      this.sendProtocolResponseOnce(
        message,
        createNativeErrorResponse(
          message,
          new NativeProtocolError('DEADLINE_EXCEEDED', 'Request deadline exceeded'),
        ),
      );
      clearTimeout(deadlineTimer);
      this.activeProtocolControllers.delete(message.requestId);
      this.activeProtocolRequests.delete(message.requestId);
      return;
    }
    try {
      switch (message.method) {
        case 'native.start':
          await this.startServer(resolveServerPort((message.params as any)?.port));
          if (controller.signal.aborted)
            throw new NativeProtocolError('CANCELED', 'Request canceled');
          this.sendProtocolResponseOnce(message, {
            version: NATIVE_PROTOCOL_VERSION,
            type: 'response',
            requestId: message.requestId,
            traceId: message.traceId,
            ok: true,
            result: { started: true },
          });
          return;
        case 'native.stop':
          await this.stopServer();
          if (controller.signal.aborted)
            throw new NativeProtocolError('CANCELED', 'Request canceled');
          this.sendProtocolResponseOnce(message, {
            version: NATIVE_PROTOCOL_VERSION,
            type: 'response',
            requestId: message.requestId,
            traceId: message.traceId,
            ok: true,
            result: { stopped: true },
          });
          return;
        case 'file.operation':
          {
            const result = await fileHandler.handleFileRequest(message.params);
            if (controller.signal.aborted) {
              throw new NativeProtocolError(
                message.deadlineAt <= Date.now() ? 'DEADLINE_EXCEEDED' : 'CANCELED',
                'Request canceled',
              );
            }
            this.sendProtocolResponseOnce(message, createNativeResponse(message, result));
          }
          return;
        default:
          this.sendProtocolResponseOnce(
            message,
            createNativeErrorResponse(
              message,
              new NativeProtocolError('EXECUTION_UNKNOWN', `Unsupported method: ${message.method}`),
            ),
          );
      }
    } catch (error) {
      const errorCode = controller.signal.aborted
        ? message.deadlineAt <= Date.now()
          ? 'DEADLINE_EXCEEDED'
          : 'CANCELED'
        : error instanceof NativeProtocolError
          ? error.code
          : 'BROWSER_ERROR';
      this.sendProtocolResponseOnce(
        message,
        createNativeErrorResponse(
          message,
          new NativeProtocolError(
            errorCode,
            error instanceof Error ? error.message : String(error),
          ),
        ),
      );
    } finally {
      clearTimeout(deadlineTimer);
      this.activeProtocolRequests.delete(message.requestId);
      this.activeProtocolControllers.delete(message.requestId);
    }
  }

  private sendProtocolResponseOnce(request: NativeRequest, response: object): void {
    if (this.respondedProtocolRequests.has(request.requestId)) return;
    if (this.respondedProtocolRequests.size >= this.maxDeduplicatedRequests) {
      const oldest = this.respondedProtocolRequests.values().next().value;
      if (typeof oldest === 'string') this.respondedProtocolRequests.delete(oldest);
    }
    this.respondedProtocolRequests.add(request.requestId);
    this.sendMessage(response);
  }

  /**
   * Send request to Chrome and wait for response
   * @param messagePayload Data to send to Chrome
   * @param timeoutMs Timeout for waiting response (milliseconds)
   * @returns Promise, resolves to Chrome's returned payload on success, rejects on failure
   */
  public sendRequestToExtensionAndWait(
    messagePayload: any,
    messageType: string = 'request_data',
    timeoutMs: number = TIMEOUTS.DEFAULT_REQUEST_TIMEOUT,
    signal?: AbortSignal,
    onProgress?: (payload: any) => void | Promise<void>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(
          new NativeProtocolError(
            'NATIVE_DISCONNECTED',
            'Chrome extension is not connected to the Native Host.',
          ),
        );
        return;
      }
      const requestId = randomUUID();
      const traceId = randomUUID();
      const deadlineAt = Date.now() + timeoutMs;
      const method = this.protocolMethodFor(messageType);
      const sideEffect = this.isSideEffectRequest(method, messagePayload);
      let settled = false;

      const cancel = () => {
        const pending = this.pendingRequests.get(requestId);
        if (!pending || pending.settled) return;
        clearTimeout(pending.timeoutId);
        pending.settled = true;
        this.pendingRequests.delete(requestId);
        this.sendMessage({
          version: NATIVE_PROTOCOL_VERSION,
          type: 'cancel',
          requestId,
          traceId,
          reason: 'client_abort',
        });
        reject(
          new NativeProtocolError(
            sideEffect ? 'EXECUTION_UNKNOWN' : 'CANCELED',
            sideEffect
              ? 'Side-effect execution state is unknown after cancellation'
              : 'Request canceled',
          ),
        );
      };
      if (signal?.aborted) {
        reject(new NativeProtocolError('CANCELED', 'Request canceled'));
        return;
      }
      signal?.addEventListener('abort', cancel, { once: true });

      const timeoutId = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (!pending || pending.settled) return;
        pending.settled = true;
        this.pendingRequests.delete(requestId);
        signal?.removeEventListener('abort', cancel);
        this.sendMessage({
          version: NATIVE_PROTOCOL_VERSION,
          type: 'cancel',
          requestId,
          traceId,
          reason: 'deadline_exceeded',
        });
        reject(
          new NativeProtocolError(
            sideEffect ? 'EXECUTION_UNKNOWN' : 'DEADLINE_EXCEEDED',
            sideEffect
              ? 'Side-effect execution state is unknown after deadline cancellation'
              : `Request deadline exceeded at ${deadlineAt}`,
          ),
        );
      }, timeoutMs);

      // Store request's resolve/reject functions and timeout ID
      this.pendingRequests.set(requestId, {
        resolve: (value) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener('abort', cancel);
          resolve(value);
        },
        reject: (reason) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener('abort', cancel);
          reject(reason);
        },
        onProgress,
        timeoutId,
        traceId,
        method,
        sideEffect,
        settled: false,
      });

      // Send message with requestId to Chrome
      this.sendMessage({
        version: NATIVE_PROTOCOL_VERSION,
        type: 'request',
        requestId,
        traceId,
        method,
        deadlineAt,
        params: messagePayload,
      });
    });
  }

  private isSideEffectRequest(method: string, payload: any): boolean {
    if (method === 'rr.runFlow' || method === 'file.operation') return true;
    if (method !== 'browser.callTool') return false;
    const name = typeof payload?.name === 'string' ? payload.name : '';
    return /(?:click|submit|delete|download|upload|create|close|navigate|fill|select|keyboard|paste|bookmark|storage_(?:set|delete)|dialog|userscript|proxy|record|rotate|post_to)/i.test(
      name,
    );
  }

  private protocolMethodFor(messageType: string): string {
    switch (messageType) {
      case 'call_tool':
        return 'browser.callTool';
      case 'process_data':
        return 'browser.processData';
      case 'rr_list_published_flows':
        return 'rr.listPublishedFlows';
      case 'rr_run_flow':
        return 'rr.runFlow';
      default:
        return messageType;
    }
  }

  /**
   * Start Fastify server (now accepts Server instance)
   */
  private async startServer(port: number, allowPortTakeover = true): Promise<void> {
    if (!this.associatedServer) {
      this.sendError('Internal error: server instance not set');
      return;
    }
    try {
      if (this.associatedServer.isRunning) {
        await this.associatedServer.startService();
        this.sendMessage({
          version: NATIVE_PROTOCOL_VERSION,
          type: 'event',
          event: 'native.serverStarted',
          data: { port },
        });
        return;
      }

      await this.associatedServer.start(port, this);

      this.sendMessage({
        version: NATIVE_PROTOCOL_VERSION,
        type: 'event',
        event: 'native.serverStarted',
        data: { port },
      });
    } catch (error: any) {
      // A manually opened service instance may already own the port. Ask that
      // instance to stop, then let the Chrome-launched Native Messaging host
      // take over so HTTP requests and the native connection share one process.
      if (allowPortTakeover && isAddressInUse(error)) {
        const takeoverAccepted = await requestPortTakeover(port);
        if (takeoverAccepted) {
          await waitForPortAvailable(port);
          await this.startServer(port, false);
          return;
        }
      }

      // If another unrelated/native host owns the port, keep the connection
      // alive and let the existing server decide whether it can serve requests.
      if (isAddressInUse(error)) {
        this.sendMessage({
          version: NATIVE_PROTOCOL_VERSION,
          type: 'event',
          event: 'native.serverStarted',
          data: { port, reused: true },
        });
        return;
      }
      this.sendError(`Failed to start server: ${error.message}`);
    }
  }

  /**
   * Stop Fastify server
   */
  public async stopService(): Promise<void> {
    if (!this.associatedServer) {
      this.sendError('Internal error: server instance not set');
      return;
    }
    try {
      // Check status through associatedServer
      if (!this.associatedServer.isRunning) {
        this.sendError('Server is not running', 'BROWSER_ERROR');
        return;
      }

      await this.associatedServer.stopService();

      this.sendMessage({
        version: NATIVE_PROTOCOL_VERSION,
        type: 'event',
        event: 'native.serverStopped',
      });
    } catch (error: any) {
      this.sendError(`Failed to stop server: ${error.message}`);
    }
  }

  public async startService(port = resolveServerPort(NATIVE_SERVER_PORT)): Promise<void> {
    await this.startServer(port);
  }

  private async stopServer(): Promise<void> {
    await this.stopService();
  }

  /**
   * Send message to Chrome extension
   */
  public sendMessage(message: any): void {
    if (this.standaloneMode) return;

    try {
      const messageString = JSON.stringify(message);
      const messageBuffer = Buffer.from(messageString);
      const headerBuffer = Buffer.alloc(4);
      headerBuffer.writeUInt32LE(messageBuffer.length, 0);
      // Ensure atomic write
      stdout.write(Buffer.concat([headerBuffer, messageBuffer]), (err) => {
        if (err) {
          // Consider how to handle write failure, may affect request completion
        } else {
          // Message sent successfully, no action needed
        }
      });
    } catch (error: any) {
      // Catch JSON.stringify or Buffer operation errors
      // If preparation stage fails, associated request may never be sent
      // Need to consider whether to reject corresponding Promise (if called within sendRequestToExtensionAndWait)
    }
  }

  /**
   * Send error message to Chrome extension (mainly for sending non-request-response type errors)
   */
  private sendError(errorMessage: string, code: string = 'INVALID_REQUEST'): void {
    this.sendMessage({
      version: NATIVE_PROTOCOL_VERSION,
      type: 'event',
      event: 'native.error',
      data: { code, message: errorMessage },
    });
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.connected = false;
    this.connectionState = 'stopped';
    // Reject all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(
        new NativeProtocolError(
          pending.sideEffect ? 'EXECUTION_UNKNOWN' : 'NATIVE_DISCONNECTED',
          'Native host is shutting down or Chrome disconnected.',
        ),
      );
    });
    this.pendingRequests.clear();
    for (const controller of this.activeProtocolControllers.values()) controller.abort();
    this.activeProtocolControllers.clear();

    if (this.associatedServer && this.associatedServer.isRunning) {
      this.associatedServer
        .stop()
        .then(() => {
          process.exit(0);
        })
        .catch(() => {
          process.exit(1);
        });
    } else {
      process.exit(0);
    }
  }
}

const nativeMessagingHostInstance = new NativeMessagingHost();
export default nativeMessagingHostInstance;
