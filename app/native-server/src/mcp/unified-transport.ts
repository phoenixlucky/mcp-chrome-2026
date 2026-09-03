import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { NativeProtocolError } from '@ethanwilkins/chrome-mcp-shared-2026';

export interface UnifiedMcpClientOptions {
  url?: string;
  compatUrl?: string;
  headers?: Record<string, string>;
  clientName?: string;
  clientVersion?: string;
  connectTimeoutMs?: number;
  connectAttempts?: number;
}

export interface UnifiedRequestOptions {
  signal?: AbortSignal;
  deadlineAt?: number;
  timeoutMs?: number;
  onProgress?: (progress: any) => void;
  meta?: Record<string, unknown>;
}

function endpointWithPath(url: string, path: '/mcp-new' | '/mcp'): string {
  const parsed = new URL(url);
  parsed.pathname = path;
  parsed.search = '';
  return parsed.toString();
}

function defaultCompatUrl(url: string): string {
  const parsed = new URL(url);
  return endpointWithPath(parsed.pathname.endsWith('/mcp-new') ? url : url, '/mcp');
}

function remainingMs(options: UnifiedRequestOptions, fallback: number): number {
  const fromDeadline =
    options.deadlineAt === undefined ? fallback : options.deadlineAt - Date.now();
  return Math.max(1, Math.min(options.timeoutMs ?? fallback, fromDeadline));
}

function withDeadline(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('deadline exceeded')), timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    },
  };
}

function mapTransportError(error: unknown): NativeProtocolError {
  if (error instanceof NativeProtocolError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|cancel/i.test(message)) return new NativeProtocolError('CANCELED', message);
  if (/timeout|deadline/i.test(message)) {
    return new NativeProtocolError('DEADLINE_EXCEEDED', message);
  }
  if (/fetch failed|econnrefused|socket|network|connect/i.test(message)) {
    return new NativeProtocolError('NATIVE_DISCONNECTED', message);
  }
  return new NativeProtocolError('BROWSER_ERROR', message);
}

/** Shared MCP client used by STDIO, agent and profile adapters. */
export class UnifiedMcpClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private connectedUrl: string | null = null;
  private connecting: Promise<void> | null = null;

  private readonly url: string;
  private readonly compatUrl: string;
  private readonly headers: Record<string, string>;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private readonly connectTimeoutMs: number;
  private readonly connectAttempts: number;

  constructor(options: UnifiedMcpClientOptions = {}) {
    this.url = options.url || 'http://127.0.0.1:12306/mcp-new';
    this.compatUrl = options.compatUrl || defaultCompatUrl(this.url);
    this.headers = options.headers || {};
    this.clientName = options.clientName || 'chrome-mcp-unified-client';
    this.clientVersion = options.clientVersion || '2';
    this.connectTimeoutMs = options.connectTimeoutMs || 8_000;
    this.connectAttempts = Math.max(1, options.connectAttempts || 2);
  }

  async connect(options: UnifiedRequestOptions = {}): Promise<void> {
    if (this.client && this.connectedUrl) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.connectWithFallback(options).finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  async listTools(options: UnifiedRequestOptions = {}): Promise<{ tools: any[] }> {
    await this.connect(options);
    const timeoutMs = remainingMs(options, this.connectTimeoutMs);
    const deadline = withDeadline(options.signal, timeoutMs);
    try {
      const abort = new Promise<never>((_, reject) => {
        const fail = () => reject(deadline.signal.reason || new Error('deadline exceeded'));
        if (deadline.signal.aborted) fail();
        else deadline.signal.addEventListener('abort', fail, { once: true });
      });
      return (await Promise.race([this.client!.listTools(), abort])) as { tools: any[] };
    } catch (error) {
      await this.reset();
      throw mapTransportError(error);
    } finally {
      deadline.dispose();
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    options: UnifiedRequestOptions = {},
  ): Promise<CallToolResult> {
    await this.connect(options);
    const timeoutMs = remainingMs(options, 120_000);
    const deadline = withDeadline(options.signal, timeoutMs);
    try {
      const result = await this.client!.callTool(
        { name, arguments: args, ...(options.meta ? { _meta: options.meta } : {}) },
        undefined,
        {
          timeout: timeoutMs,
          signal: deadline.signal,
          onprogress: options.onProgress,
        },
      );
      return result as CallToolResult;
    } catch (error) {
      await this.reset();
      throw mapTransportError(error);
    } finally {
      deadline.dispose();
    }
  }

  async reset(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.transport = null;
    this.connectedUrl = null;
    await client?.close().catch(() => undefined);
  }

  async close(): Promise<void> {
    await this.reset();
  }

  get endpoint(): string | null {
    return this.connectedUrl;
  }

  private async connectWithFallback(options: UnifiedRequestOptions): Promise<void> {
    const endpoints = [...new Set([this.url, this.compatUrl])];
    let lastError: unknown;
    for (const endpoint of endpoints) {
      for (let attempt = 0; attempt < this.connectAttempts; attempt += 1) {
        const timeoutMs = remainingMs(options, this.connectTimeoutMs);
        const deadline = withDeadline(options.signal, timeoutMs);
        const client = new Client(
          { name: this.clientName, version: this.clientVersion },
          { capabilities: {} },
        );
        const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
          requestInit: { headers: this.headers, signal: deadline.signal },
        });
        try {
          await client.connect(transport);
          this.client = client;
          this.transport = transport;
          this.connectedUrl = endpoint;
          deadline.dispose();
          return;
        } catch (error) {
          deadline.dispose();
          lastError = error;
          await client.close().catch(() => undefined);
        }
      }
    }
    throw mapTransportError(lastError || new Error('MCP transport connection failed'));
  }
}
