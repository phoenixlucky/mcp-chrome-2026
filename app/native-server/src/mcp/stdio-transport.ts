import process from 'node:process';
import type { Readable, Writable } from 'node:stream';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export type StdioFraming = 'line' | 'content-length';

const DEFAULT_MAX_BUFFER_SIZE = 10 * 1024 * 1024;

function parseMessage(lineOrBody: Buffer): JSONRPCMessage {
  return JSON.parse(lineOrBody.toString('utf8')) as JSONRPCMessage;
}

export function serializeStdioMessage(message: JSONRPCMessage, framing: StdioFraming): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return framing === 'content-length'
    ? Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body])
    : Buffer.concat([body, Buffer.from('\n', 'ascii')]);
}

/** Incremental decoder for both MCP newline JSON and Content-Length framing. */
export class StdioMessageDecoder {
  private buffer = Buffer.alloc(0);
  private readonly maxBufferSize: number;
  framing: StdioFraming | null = null;

  constructor(maxBufferSize = DEFAULT_MAX_BUFFER_SIZE) {
    this.maxBufferSize = maxBufferSize;
  }

  append(chunk: Buffer): JSONRPCMessage[] {
    if (!chunk.length) return [];
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = Buffer.alloc(0);
      throw new Error(`STDIO buffer exceeded ${this.maxBufferSize} bytes`);
    }
    const messages: JSONRPCMessage[] = [];
    while (true) {
      const message = this.readMessage();
      if (!message) break;
      messages.push(message);
    }
    return messages;
  }

  clear(): void {
    this.buffer = Buffer.alloc(0);
  }

  private readMessage(): JSONRPCMessage | null {
    const headerEnd = this.buffer.indexOf('\r\n\r\n');
    const headerStart = this.buffer.toString('ascii', 0, Math.min(this.buffer.length, 32));
    if (headerStart.trimStart().toLowerCase().startsWith('content-length:')) {
      if (headerEnd < 0) return null;
      const headers = this.buffer.subarray(0, headerEnd).toString('ascii');
      const match = headers.match(/^content-length\s*:\s*(\d+)\s*$/im);
      const length = match ? Number(match[1]) : NaN;
      if (!Number.isSafeInteger(length) || length <= 0 || length > this.maxBufferSize) {
        throw new Error('Invalid Content-Length header');
      }
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return null;
      const body = this.buffer.subarray(bodyStart, bodyStart + length);
      this.buffer = this.buffer.subarray(bodyStart + length);
      this.framing = 'content-length';
      return parseMessage(body);
    }

    const newline = this.buffer.indexOf('\n');
    if (newline < 0) return null;
    const line = this.buffer.subarray(0, newline).toString('utf8').replace(/\r$/, '');
    this.buffer = this.buffer.subarray(newline + 1);
    if (!line.trim()) return this.readMessage();
    this.framing = 'line';
    return parseMessage(Buffer.from(line, 'utf8'));
  }
}

/** MCP transport for STDIO adapters; replies using the framing selected by the peer. */
export class UnifiedStdioServerTransport {
  private readonly decoder: StdioMessageDecoder;
  private started = false;
  private readonly onData = (chunk: Buffer | string) => {
    try {
      for (const message of this.decoder.append(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      )) {
        this.onmessage?.(message);
      }
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
    }
  };
  private readonly onError = (error: Error) => this.onerror?.(error);

  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(
    private readonly stdin: Readable = process.stdin,
    private readonly stdout: Writable = process.stdout,
    maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
  ) {
    this.decoder = new StdioMessageDecoder(maxBufferSize);
  }

  async start(): Promise<void> {
    if (this.started) throw new Error('STDIO transport already started');
    this.started = true;
    this.stdin.on('data', this.onData);
    this.stdin.on('error', this.onError);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const framing = this.decoder.framing || 'line';
    const data = serializeStdioMessage(message, framing);
    await new Promise<void>((resolve, reject) => {
      const accepted = this.stdout.write(data, (error) => (error ? reject(error) : resolve()));
      if (!accepted) this.stdout.once('drain', resolve);
    });
  }

  async close(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.stdin.off('data', this.onData);
    this.stdin.off('error', this.onError);
    this.decoder.clear();
    this.onclose?.();
  }
}
