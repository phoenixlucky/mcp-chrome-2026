import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

describe('CDP session manager', () => {
  beforeEach(() => {
    (chrome.debugger.getTargets as any).mockResolvedValue([]);
    (chrome.debugger.attach as any).mockResolvedValue(undefined);
    (chrome.debugger.detach as any).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cdpSessionManager.abortOwner(501, 'first');
    await cdpSessionManager.abortOwner(501, 'second');
    await cdpSessionManager.abortOwner(502, 'javascript');
    await cdpSessionManager.abortOwner(503, 'javascript');
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
});
