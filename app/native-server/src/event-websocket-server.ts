import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { MCP_ALLOWED_ORIGINS_ENV, MCP_EXTENSION_ID_ENV } from './constant/index.js';

export interface EventChannelInfo {
  port: number;
  token: string;
  expiresAt: number;
}

const MAX_FRAME_BYTES = 1 * 1024 * 1024;
const MAX_CONNECTIONS = 1;
const IDLE_TIMEOUT_MS = 90_000;
const TOKEN_TTL_MS = 5 * 60_000;

function allowedOrigins(): string[] {
  return (process.env.CHROME_MCP_WS_ALLOWED_ORIGINS || process.env[MCP_ALLOWED_ORIGINS_ENV] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const configured = allowedOrigins();
  if (configured.length) return configured.includes(origin);
  const expectedExtensionId = process.env[MCP_EXTENSION_ID_ENV]?.trim();
  return expectedExtensionId
    ? origin === `chrome-extension://${expectedExtensionId}`
    : /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

function closeSocket(socket: net.Socket, code = 1008): void {
  try {
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code, 0);
    const frame = Buffer.concat([Buffer.from([0x88, payload.length]), payload]);
    socket.write(frame);
  } catch {
    // The peer may already be gone.
  }
  socket.destroy();
}

export class LocalEventWebSocketServer {
  private readonly server = http.createServer((_request, response) => {
    response.writeHead(404).end();
  });
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private token = '';
  private tokenExpiresAt = 0;
  private tokenUsed = false;
  private channelInfo: EventChannelInfo | null = null;
  private readonly onMessage: (message: unknown) => void;

  constructor(onMessage: (message: unknown) => void = () => undefined) {
    this.onMessage = onMessage;
    this.server.maxConnections = MAX_CONNECTIONS;
    this.server.on('upgrade', (request, socket, head) =>
      this.handleUpgrade(request, socket as net.Socket, head),
    );
  }

  async start(): Promise<EventChannelInfo> {
    if (this.channelInfo && Date.now() < this.tokenExpiresAt && !this.tokenUsed)
      return this.channelInfo;
    if (!this.server.listening) {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          this.server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          this.server.off('error', onError);
          resolve();
        };
        this.server.once('error', onError);
        this.server.once('listening', onListening);
        this.server.listen(0, '127.0.0.1');
      });
    }
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('Event channel failed to bind');
    this.token = crypto.randomBytes(32).toString('base64url');
    this.tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    this.tokenUsed = false;
    this.channelInfo = { port: address.port, token: this.token, expiresAt: this.tokenExpiresAt };
    return this.channelInfo;
  }

  publish(message: unknown): boolean {
    if (!this.socket || this.socket.destroyed) return false;
    const payload = Buffer.from(JSON.stringify(message));
    if (payload.length > MAX_FRAME_BYTES) return false;
    const header =
      payload.length < 126
        ? Buffer.from([0x81, payload.length])
        : payload.length < 65_536
          ? Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff])
          : Buffer.from([
              0x81,
              127,
              0,
              0,
              0,
              0,
              payload.length >>> 24,
              (payload.length >>> 16) & 0xff,
              (payload.length >>> 8) & 0xff,
              payload.length & 0xff,
            ]);
    try {
      this.socket.write(Buffer.concat([header, payload]));
      return true;
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    if (this.socket) closeSocket(this.socket, 1001);
    this.socket = null;
    this.channelInfo = null;
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private handleUpgrade(request: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const providedToken = url.searchParams.get('token') || '';
    if (
      url.pathname !== '/events' ||
      !this.channelInfo ||
      this.tokenUsed ||
      Date.now() >= this.tokenExpiresAt ||
      !providedToken ||
      providedToken.length !== this.token.length ||
      !crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(this.token)) ||
      !isAllowedOrigin(
        typeof request.headers.origin === 'string' ? request.headers.origin : undefined,
      ) ||
      this.socket
    ) {
      socket.destroy();
      return;
    }

    const key = request.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.destroy();
      return;
    }
    this.tokenUsed = true;
    this.socket = socket;
    this.buffer = head;
    socket.setNoDelay(true);
    socket.setTimeout(IDLE_TIMEOUT_MS, () => closeSocket(socket, 1001));
    socket.on('data', (chunk) => {
      socket.setTimeout(IDLE_TIMEOUT_MS);
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processFrames(socket);
    });
    socket.on('close', () => {
      if (this.socket === socket) this.socket = null;
    });
    socket.on('error', () => {
      if (this.socket === socket) this.socket = null;
    });
    const accept = crypto
      .createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    if (this.buffer.length) this.processFrames(socket);
  }

  private processFrames(socket: net.Socket): void {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;
      if (!masked) return closeSocket(socket, 1002);
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10 || this.buffer.readUInt32BE(2) !== 0)
          return closeSocket(socket, 1009);
        length = this.buffer.readUInt32BE(6);
        offset = 10;
      }
      if (length > MAX_FRAME_BYTES) return closeSocket(socket, 1009);
      const frameSize = offset + 4 + length;
      if (this.buffer.length < frameSize) return;
      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.alloc(length);
      for (let i = 0; i < length; i += 1) payload[i] = this.buffer[offset + 4 + i] ^ mask[i % 4];
      this.buffer = this.buffer.subarray(frameSize);
      const opcode = first & 0x0f;
      if (opcode === 0x8) return closeSocket(socket, 1000);
      if (opcode === 0x9) {
        socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
        continue;
      }
      if (opcode !== 0x1) return closeSocket(socket, 1003);
      try {
        const message = JSON.parse(payload.toString('utf8'));
        if ((message as any)?.type === 'ping') this.publish({ type: 'pong', at: Date.now() });
        else this.onMessage(message);
      } catch {
        return closeSocket(socket, 1007);
      }
    }
  }
}
