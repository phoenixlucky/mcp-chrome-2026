import { describe, expect, test } from '@jest/globals';
import { NativeProtocolError } from '@ethanwilkins/chrome-mcp-shared-2026';
import { McpToolTimeout, isMcpToolTimeout, toMcpToolTimeout } from './errors.js';

describe('McpToolTimeout', () => {
  test.each([
    Object.assign(new Error('request timed out'), { name: 'TimeoutError' }),
    Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' }),
    Object.assign(new Error('socket timeout'), { code: 'ERR_SOCKET_TIMEOUT' }),
    new NativeProtocolError('DEADLINE_EXCEEDED', 'Request deadline exceeded'),
  ])('recognizes timeout-shaped errors', (error) => {
    expect(isMcpToolTimeout(error)).toBe(true);
    expect(toMcpToolTimeout(error)).toBeInstanceOf(McpToolTimeout);
  });

  test('preserves an existing normalized timeout', () => {
    const error = new McpToolTimeout('navigation timed out');
    expect(toMcpToolTimeout(error)).toBe(error);
    expect(error.code).toBe('DEADLINE_EXCEEDED');
  });

  test('does not classify ordinary browser failures as timeouts', () => {
    expect(isMcpToolTimeout(new Error('page returned HTTP 500'))).toBe(false);
  });
});
