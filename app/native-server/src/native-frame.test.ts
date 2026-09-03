import { describe, expect, test } from '@jest/globals';
import { MAX_NATIVE_MESSAGE_SIZE_BYTES, NativeMessageFrameDecoder } from './native-frame.js';

function frame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

describe('NativeMessageFrameDecoder', () => {
  test('handles a half frame and then a coalesced pair of frames', () => {
    const decoder = new NativeMessageFrameDecoder();
    const first = frame({ id: 1 });
    const second = frame({ id: 2 });
    const third = frame({ id: 3 });

    decoder.append(first.subarray(0, 2));
    expect(decoder.readMessages()).toHaveLength(0);
    decoder.append(Buffer.concat([first.subarray(2), second, third]));

    expect(decoder.readMessages().map((body) => JSON.parse(body.toString()))).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  test('limits one read and keeps remaining complete frames buffered', () => {
    const decoder = new NativeMessageFrameDecoder();
    decoder.append(Buffer.concat(Array.from({ length: 3 }, (_, id) => frame({ id }))));

    expect(decoder.readMessages(2)).toHaveLength(2);
    expect(decoder.hasCompleteMessage()).toBe(true);
    expect(JSON.parse(decoder.readMessages()[0].toString())).toEqual({ id: 2 });
  });

  test('rejects an unsafe Native Messaging frame length', () => {
    const decoder = new NativeMessageFrameDecoder();
    const header = Buffer.alloc(4);
    header.writeUInt32LE(MAX_NATIVE_MESSAGE_SIZE_BYTES + 1, 0);
    decoder.append(header);

    expect(() => decoder.readMessages()).toThrow(
      `Invalid message length: ${MAX_NATIVE_MESSAGE_SIZE_BYTES + 1}`,
    );
  });
});
