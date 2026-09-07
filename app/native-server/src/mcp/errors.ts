import { NativeProtocolError } from '@ethanwilkins/chrome-mcp-shared-2026';

/** A tool request exceeded its transport or execution deadline. */
export class McpToolTimeout extends NativeProtocolError {
  constructor(message = 'MCP tool timed out', details?: unknown) {
    super('DEADLINE_EXCEEDED', message, details);
    this.name = 'McpToolTimeout';
  }
}

function errorValue(error: unknown): Record<string, unknown> | undefined {
  return error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined;
}

/** Recognize timeout errors from Node, undici, sockets, and MCP/native layers. */
export function isMcpToolTimeout(error: unknown): boolean {
  if (error instanceof McpToolTimeout) return true;
  const value = errorValue(error);
  const name = typeof value?.name === 'string' ? value.name : '';
  const code = typeof value?.code === 'string' ? value.code : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    /^timeout(?:error)?$/i.test(name) ||
    /^(?:ETIMEDOUT|ESOCKETTIMEDOUT|ERR_SOCKET_TIMEOUT|UND_ERR_CONNECT_TIMEOUT)$/i.test(code) ||
    /^DEADLINE_EXCEEDED$/i.test(code) ||
    /(?:timed\s*out|timeout|deadline\s+exceeded)/i.test(message)
  );
}

/** Convert any timeout-shaped failure to the one error type used by MCP tools. */
export function toMcpToolTimeout(error: unknown): McpToolTimeout {
  if (error instanceof McpToolTimeout) return error;
  const value = errorValue(error);
  const message = error instanceof Error ? error.message : String(error);
  return new McpToolTimeout(message || 'MCP tool timed out', {
    causeName: typeof value?.name === 'string' ? value.name : undefined,
    causeCode: typeof value?.code === 'string' ? value.code : undefined,
  });
}
