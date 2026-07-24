import { beforeEach, describe, expect, it, vi } from 'vitest';

const { attach } = vi.hoisted(() => ({ attach: vi.fn() }));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: { attach, detach: vi.fn(), sendCommand: vi.fn() },
}));

import {
  isNetworkCapturableUrl,
  networkDebuggerStartTool,
} from '@/entrypoints/background/tools/browser/network-capture-debugger';

describe('network capture URL guard', () => {
  it('rejects Chrome internal pages before debugger attachment', () => {
    expect(isNetworkCapturableUrl('chrome://extensions')).toBe(false);
    expect(isNetworkCapturableUrl('https://example.com')).toBe(true);
  });

  it('does not attach the debugger to Chrome internal pages', async () => {
    (chrome.tabs.query as any).mockResolvedValue([{ id: 1, url: 'chrome://extensions' }]);
    (chrome.tabs.get as any).mockResolvedValue({ id: 1, url: 'chrome://extensions' });

    const result = await networkDebuggerStartTool.execute({});

    expect(result.isError).toBe(true);
    expect(attach).not.toHaveBeenCalled();
  });
});
