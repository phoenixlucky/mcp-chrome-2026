import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { withSession, sendCommand, abortOwner } = vi.hoisted(() => ({
  withSession: vi.fn(),
  sendCommand: vi.fn(),
  abortOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: { withSession, sendCommand, abortOwner },
}));

import { waitTool } from '@/entrypoints/background/tools/browser/wait';

function readResult(result: any): Record<string, unknown> {
  return JSON.parse(result.content[0].text);
}

describe('chrome_wait cancellation and deadline handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (chrome.tabs.get as any).mockResolvedValue({ id: 42, url: 'https://example.com' });
    (chrome.tabs.query as any).mockResolvedValue([{ id: 42, windowId: 1, active: true }]);
    withSession.mockImplementation((_tabId: number, _owner: string, fn: () => Promise<unknown>) =>
      fn(),
    );
    sendCommand.mockReset();
    abortOwner.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns when a mutation CDP evaluation never resolves', async () => {
    sendCommand.mockImplementation(() => new Promise(() => undefined));

    const pending = waitTool.execute(
      { event: 'mutation', selector: 'body', timeout: 20 },
      undefined,
    );
    await vi.advanceTimersByTimeAsync(1_021);
    const result = await pending;

    expect(result.isError).toBe(false);
    expect(readResult(result)).toMatchObject({ found: false, timeout: true });
    expect(abortOwner).toHaveBeenCalledWith(42, 'wait');
  });

  it('propagates cancellation while Runtime.evaluate is pending', async () => {
    sendCommand.mockImplementation(() => new Promise(() => undefined));
    const controller = new AbortController();
    const pending = waitTool.execute(
      { event: 'mutation', selector: 'body', timeout: 20_000 },
      controller.signal,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(sendCommand).toHaveBeenCalledWith(42, 'Runtime.evaluate', expect.anything());
    controller.abort();
    const result = await pending;

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'Wait failed: Wait cancelled' });
    expect(abortOwner).toHaveBeenCalledWith(42, 'wait');
  });

  it('does not let a stuck polling evaluation exceed the wait timeout', async () => {
    sendCommand.mockImplementation(() => new Promise(() => undefined));

    const pending = waitTool.execute({ selector: 'body', timeout: 20, pollInterval: 5 }, undefined);
    await vi.advanceTimersByTimeAsync(20);
    const result = await pending;

    expect(result.isError).toBe(false);
    expect(readResult(result)).toMatchObject({ found: false, timeout: 20 });
    expect(abortOwner).toHaveBeenCalledWith(42, 'wait');
  });
});
