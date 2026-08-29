export enum NATIVE_MESSAGE_TYPE {
  START = 'start',
  STARTED = 'started',
  STOP = 'stop',
  STOPPED = 'stopped',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
}

export const NATIVE_SERVER_PORT = 12306;

// Timeout constants (in milliseconds)
export const TIMEOUTS = {
  DEFAULT_REQUEST_TIMEOUT: 15000,
  EXTENSION_REQUEST_TIMEOUT: 20000,
  PROCESS_DATA_TIMEOUT: 20000,
} as const;

// Server configuration
export const SERVER_CONFIG = {
  HOST: '127.0.0.1',
  LOGGER_ENABLED: false,
} as const;

/**
 * Validate browser Origin values without prefix matching.
 * Prefix matching would allow origins such as http://127.0.0.1.evil.example.
 */
export function isAllowedCorsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
      return Boolean(url.hostname);
    }
    return (
      url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_SERVER_ERROR: 500,
  GATEWAY_TIMEOUT: 504,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NATIVE_HOST_NOT_AVAILABLE: 'Native host connection not established.',
  SERVER_NOT_RUNNING: 'Server is not actively running.',
  REQUEST_TIMEOUT: 'Request to extension timed out.',
  INVALID_MCP_REQUEST: 'Invalid MCP request or session.',
  UNAUTHORIZED: 'Missing or invalid MCP API key.',
  ORIGIN_NOT_ALLOWED: 'MCP requests must include an allowed Origin or a valid API key.',
  INVALID_SESSION_ID: 'Invalid or missing MCP session ID.',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  MCP_SESSION_DELETION_ERROR: 'Internal server error during MCP session deletion.',
  MCP_REQUEST_PROCESSING_ERROR: 'Internal server error during MCP request processing.',
  INVALID_SSE_SESSION: 'Invalid or missing MCP session ID for SSE.',
} as const;

// ============================================================
// Chrome MCP Server Configuration
// ============================================================

/**
 * Environment variables for dynamically resolving the local MCP HTTP endpoint.
 * CHROME_MCP_PORT is the preferred source; MCP_HTTP_PORT is kept for backward compatibility.
 */
export const CHROME_MCP_PORT_ENV = 'CHROME_MCP_PORT';
export const MCP_HTTP_PORT_ENV = 'MCP_HTTP_PORT';
export const MCP_API_KEY_ENV = 'CHROME_MCP_API_KEY';
export const MCP_ALLOWED_TOOLS_ENV = 'CHROME_MCP_ALLOWED_TOOLS';
export const MCP_APPROVED_TOOLS_ENV = 'CHROME_MCP_APPROVED_TOOLS';
export const MCP_REQUIRE_APPROVAL_ENV = 'CHROME_MCP_REQUIRE_APPROVAL';

/**
 * Get the actual port the Chrome MCP server is listening on.
 * Priority: CHROME_MCP_PORT env > MCP_HTTP_PORT env > NATIVE_SERVER_PORT default
 */
export function getChromeMcpPort(): number {
  const raw = process.env[CHROME_MCP_PORT_ENV] || process.env[MCP_HTTP_PORT_ENV];
  const port = raw ? Number.parseInt(String(raw), 10) : NaN;
  return Number.isFinite(port) && port > 0 && port <= 65535 ? port : NATIVE_SERVER_PORT;
}

/**
 * Get the full URL to the local Chrome MCP HTTP endpoint.
 * This URL is used by Claude/Codex agents to connect to the MCP server.
 */
export function getChromeMcpUrl(): string {
  return `http://${SERVER_CONFIG.HOST}:${getChromeMcpPort()}/mcp`;
}
