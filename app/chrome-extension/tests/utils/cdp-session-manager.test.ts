import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

describe('CDP session manager', () => {
  beforeEach(() => {
    (chrome.debugger.getTargets as any).mockResolvedValue([]);
    (chrome.debugger.attach as any).mockResolvedValue(undefined);
    (chrome.debugger.detach as any).mockResolvedValue(undefined);
    (chrome.debugger.sendCommand as any).mockReset().mockResolvedValue({});
  });

  afterEach(async () => {
    await cdpSessionManager.abortOwner(501, 'first');
    await cdpSessionManager.abortOwner(501, 'second');
    await cdpSessionManager.abortOwner(502, 'javascript');
    await cdpSessionManager.abortOwner(503, 'javascript');
    await cdpSessionManager.abortOwner(504, 'scroll');
    await cdpSessionManager.abortOwner(505, 'scroll');
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('serializes concurrent attach calls for the same tab', async () => {
    let releaseAttach!: () => void;
    let markAttachStarted!: () => void;
    const attachGate = new Promise<void>((resolve) => {
      releaseAttach = resolve;
    });
    const attachStarted = new Promise<void>((resolve) => {
      markAttachStarted = resolve;
    });

    (chrome.debugger.attach as any).mockImplementation(async () => {
      markAttachStarted();
      await attachGate;
    });

    const first = cdpSessionManager.attach(501, 'first');
    await attachStarted;
    const second = cdpSessionManager.attach(501, 'second');

    await Promise.resolve();
    expect(chrome.debugger.getTargets).toHaveBeenCalledTimes(1);

    releaseAttach();
    await Promise.all([first, second]);

    expect(chrome.debugger.attach).toHaveBeenCalledTimes(1);
    await cdpSessionManager.detach(501, 'first');
    await cdpSessionManager.detach(501, 'second');
    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: 501 });
  });

  it('force-releases a timed-out owner without waiting for the command lock', async () => {
    await cdpSessionManager.attach(502, 'javascript');

    await cdpSessionManager.abortOwner(502, 'javascript');

    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: 502 });
  });

  it('balances repeated references from the same owner', async () => {
    await cdpSessionManager.attach(503, 'javascript');
    await cdpSessionManager.attach(503, 'javascript');

    await cdpSessionManager.abortOwner(503, 'javascript');
    expect(chrome.debugger.detach).not.toHaveBeenCalledWith({ tabId: 503 });

    await cdpSessionManager.abortOwner(503, 'javascript');
    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: 503 });
  });

  it('times out a stuck command, detaches, and reattaches on the next call', async () => {
    vi.useFakeTimers();
    await cdpSessionManager.attach(504, 'scroll');
    (chrome.debugger.sendCommand as any).mockImplementationOnce(() => new Promise(() => undefined));

    const pending = cdpSessionManager.sendCommand(504, 'Runtime.evaluate', {}, { timeoutMs: 25 });
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'CdpCommandTimeoutError',
      tabId: 504,
      method: 'Runtime.evaluate',
      timeoutMs: 25,
      stateUnknown: true,
    });
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: 504 });

    (chrome.debugger.sendCommand as any).mockResolvedValueOnce({ ok: true });
    await expect(
      cdpSessionManager.sendCommand(504, 'Runtime.evaluate', {}, { timeoutMs: 25 }),
    ).resolves.toEqual({ ok: true });
    expect(chrome.debugger.attach).toHaveBeenCalledWith({ tabId: 504 }, '1.3');
    vi.useRealTimers();
  });

  it('cancels a stuck command and cleans up its session', async () => {
    await cdpSessionManager.attach(505, 'scroll');
    (chrome.debugger.sendCommand as any).mockImplementationOnce(() => new Promise(() => undefined));
    const controller = new AbortController();
    const pending = cdpSessionManager.sendCommand(
      505,
      'Input.dispatchMouseEvent',
      {},
      { timeoutMs: 10_000, signal: controller.signal },
    );

    controller.abort(new Error('client disconnected'));
    await expect(pending).rejects.toMatchObject({
      name: 'CdpCommandCancelledError',
      tabId: 505,
      method: 'Input.dispatchMouseEvent',
      stateUnknown: true,
    });
    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: 505 });
  });
});
