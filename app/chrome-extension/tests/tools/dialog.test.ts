import { beforeEach, describe, expect, it, vi } from 'vitest';

const { withSession, sendCommand } = vi.hoisted(() => ({
  withSession: vi.fn(),
  sendCommand: vi.fn(),
}));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: { withSession, sendCommand },
}));

import { handleDialogTool } from '@/entrypoints/background/tools/browser/dialog';

describe('chrome_handle_dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSession.mockImplementation(
      async (_tabId: number, _owner: string, fn: () => Promise<void>) => fn(),
    );
    sendCommand.mockResolvedValue({});
    (chrome.tabs.query as any).mockResolvedValue([{ id: 42, windowId: 7, active: true }]);
    (chrome.tabs.get as any).mockResolvedValue({ id: 42, windowId: 7, active: true });
  });

  it('accepts a beforeunload dialog through CDP', async () => {
    const result = await handleDialogTool.execute({ action: 'accept' });

    expect(result.isError).toBe(false);
    expect(withSession).toHaveBeenCalledWith(42, 'dialog', expect.any(Function));
    expect(sendCommand).toHaveBeenNthCalledWith(1, 42, 'Page.enable');
    expect(sendCommand).toHaveBeenNthCalledWith(2, 42, 'Page.handleJavaScriptDialog', {
      accept: true,
      promptText: undefined,
    });
  });

  it('can dismiss a dialog on an explicitly selected tab', async () => {
    (chrome.tabs.get as any).mockResolvedValue({ id: 99, windowId: 7, active: true });
    const result = await handleDialogTool.execute({ action: 'dismiss', tabId: 99 });

    expect(result.isError).toBe(false);
    expect(chrome.tabs.get).toHaveBeenCalledWith(99);
    expect(withSession).toHaveBeenCalledWith(99, 'dialog', expect.any(Function));
    expect(sendCommand).toHaveBeenNthCalledWith(2, 99, 'Page.handleJavaScriptDialog', {
      accept: false,
      promptText: undefined,
    });
  });
});
