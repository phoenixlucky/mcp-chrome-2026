import { describe, expect, test } from '@jest/globals';
import { StdioMessageDecoder, serializeStdioMessage } from './stdio-transport.js';

describe('Unified STDIO framing', () => {
  const message = { jsonrpc: '2.0', id: 1, method: 'ping' } as any;

  test('decodes newline JSON', () => {
    const decoder = new StdioMessageDecoder();
    expect(decoder.append(Buffer.from(`${JSON.stringify(message)}\n`))).toEqual([message]);
    expect(decoder.framing).toBe('line');
  });

  test('decodes Content-Length frames split across chunks', () => {
    const frame = serializeStdioMessage(message, 'content-length');
    const decoder = new StdioMessageDecoder();
    expect(decoder.append(frame.subarray(0, 10))).toEqual([]);
    expect(decoder.append(frame.subarray(10))).toEqual([message]);
    expect(decoder.framing).toBe('content-length');
  });

  test('rejects an invalid Content-Length header', () => {
    const decoder = new StdioMessageDecoder();
    expect(() => decoder.append(Buffer.from('Content-Length: nope\r\n\r\n'))).toThrow(
      'Invalid Content-Length header',
    );
  });
});
