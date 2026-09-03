import { afterEach, describe, expect, jest, test } from '@jest/globals';
import {
  NATIVE_PROTOCOL_VERSION,
  parseNativeProtocolMessage,
} from '@ethanwilkins/chrome-mcp-shared-2026';
import { NativeMessagingHost } from './native-messaging-host.js';

const hosts: any[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.getArtifactStore().dispose();
  jest.useRealTimers();
});

function createHost(): NativeMessagingHost {
  const host = new NativeMessagingHost();
  hosts.push(host);
  return host;
}

describe('NativeMessagingHost lifecycle', () => {
  test('rejects V1 and accepts a valid V2 request', () => {
    expect(() => parseNativeProtocolMessage({ version: 1, type: 'request' })).toThrow(
      expect.objectContaining({ code: 'UNSUPPORTED_VERSION' }),
    );
    expect(
      parseNativeProtocolMessage({
        version: NATIVE_PROTOCOL_VERSION,
        type: 'request',
        requestId: 'req-1',
        traceId: 'trace-1',
        method: 'browser.click',
        deadlineAt: Date.now() + 1_000,
        params: {},
      }).version,
    ).toBe(2);
  });

  test('sends cancel and reports execution-unknown for a timed-out side effect', async () => {
    jest.useFakeTimers();
    const host = createHost();
    (host as any).connected = true;
    const sendMessage = jest.spyOn(host, 'sendMessage').mockImplementation(() => undefined);

    const pending = host.sendRequestToExtensionAndWait(
      { name: 'chrome_click_element', arguments: {} },
      'call_tool',
      10,
    );
    jest.advanceTimersByTime(10);

    await expect(pending).rejects.toMatchObject({ code: 'EXECUTION_UNKNOWN' });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cancel', reason: 'deadline_exceeded' }),
    );
    expect(host.getStatus().pendingRequests).toBe(0);
  });

  test('fails pending requests on disconnect and leaves no controllers', async () => {
    const host = createHost();
    (host as any).connected = true;
    jest.spyOn(host, 'sendMessage').mockImplementation(() => undefined);
    const pending = host.sendRequestToExtensionAndWait({}, 'call_tool', 30_000);
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    (host as any).cleanup();

    await expect(pending).rejects.toMatchObject({ code: 'NATIVE_DISCONNECTED' });
    expect(host.getStatus().pendingRequests).toBe(0);
    expect((host as any).activeProtocolControllers.size).toBe(0);
    exit.mockRestore();
  });

  test('resolves consecutive requests after reconnect without losing correlation', async () => {
    const host = createHost();
    (host as any).connected = true;
    jest.spyOn(host, 'sendMessage').mockImplementation(() => undefined);
    const promises = Array.from({ length: 32 }, (_, index) =>
      host.sendRequestToExtensionAndWait({ index }, 'process_data', 30_000),
    );
    const requestIds = [...(host as any).pendingRequests.keys()];
    requestIds.forEach((requestId, index) =>
      (host as any).resolveProtocolResponse({
        version: NATIVE_PROTOCOL_VERSION,
        type: 'response',
        requestId,
        traceId: (host as any).pendingRequests.get(requestId).traceId,
        ok: true,
        result: { index },
      }),
    );

    await expect(Promise.all(promises)).resolves.toHaveLength(32);
    expect(host.getStatus().pendingRequests).toBe(0);
  });

  test('responds only once when the same write request is delivered twice', async () => {
    const host = createHost();
    const sendMessage = jest.spyOn(host, 'sendMessage').mockImplementation(() => undefined);
    jest.spyOn(host as any, 'startServer').mockResolvedValue(undefined);
    const request = {
      version: NATIVE_PROTOCOL_VERSION,
      type: 'request',
      requestId: 'duplicate-write',
      traceId: 'trace-duplicate-write',
      method: 'native.start',
      deadlineAt: Date.now() + 30_000,
      params: {},
    } as const;

    await Promise.all([
      (host as any).handleProtocolRequest(request),
      (host as any).handleProtocolRequest(request),
    ]);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'response', requestId: request.requestId, ok: true }),
    );
  });

  test('does not emit a Native Messaging frame above the safety threshold', () => {
    const host = createHost();
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

    host.sendMessage({ data: 'x'.repeat(16 * 1024 * 1024) });

    expect(write).not.toHaveBeenCalled();
    expect(host.getStatus().lastError).toMatch(/exceeds/);
    write.mockRestore();
  });
});
