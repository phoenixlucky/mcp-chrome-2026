import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseBrowserToolExecutor,
  isContentScriptDisconnectedError,
  isContentScriptMessageTimeoutError,
  normalizeContentMessageTimeoutMs,
} from '@/entrypoints/background/tools/base-browser';
import type { ToolResult } from '@/common/tool-handler';

class TestBrowserTool extends BaseBrowserToolExecutor {
  name = 'test_browser_tool';

  async execute(): Promise<ToolResult> {
    return { content: [], isError: false };
  }

  resolve(tabId?: number, windowId?: number) {
    return this.resolveTargetTab(tabId, windowId);
  }

  inject(tabId: number, files: string[]) {
    return this.injectContentScript(tabId, files);
  }

  send(tabId: number, message: any) {
    return this.sendMessageToTab(tabId, message);
  }

  sendRead(tabId: number, message: any, files: string[]) {
    return this.sendMessageToTabWithRetry(tabId, message, files);
  }
}

describe('BaseBrowserToolExecutor target tab resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chrome.tabs.sendMessage as any).mockReset().mockResolvedValue(undefined);
    (chrome.webNavigation as any).getFrame = vi.fn().mockResolvedValue({ errorOccurred: false });
  });

  it('does not fall back to the active tab when an explicit tab is missing', async () => {
    const getTab = chrome.tabs.get as unknown as ReturnType<typeof vi.fn>;
    const queryTabs = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    getTab.mockRejectedValue(new Error('No tab with id 999'));
    queryTabs.mockResolvedValue([{ id: 7, windowId: 1, active: true }]);

    const tool = new TestBrowserTool();

    await expect(tool.resolve(999)).rejects.toThrow('Target tab 999 not found');
    expect(queryTabs).not.toHaveBeenCalled();
  });

  it('resolves the active tab from the requested window when tabId is omitted', async () => {
    const queryTabs = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    queryTabs.mockResolvedValue([{ id: 12, windowId: 4, active: true }]);

    const tool = new TestBrowserTool();

    await expect(tool.resolve(undefined, 4)).resolves.toMatchObject({
      id: 12,
      windowId: 4,
    });
    expect(queryTabs).toHaveBeenCalledWith({ active: true, windowId: 4 });
  });

  it('does not inject into a frame whose navigation ended on an error page', async () => {
    const getTab = chrome.tabs.get as unknown as ReturnType<typeof vi.fn>;
    const getFrame = vi.fn().mockResolvedValue({ errorOccurred: true });
    const executeScript = vi.fn();
    getTab.mockResolvedValue({ id: 12, url: 'https://example.com' });
    (chrome.webNavigation as any).getFrame = getFrame;
    (chrome.scripting as any) = { executeScript };

    const tool = new TestBrowserTool();

    await expect(tool.inject(12, ['inject-scripts/web-fetcher-helper.js'])).rejects.toThrow(
      'Frame with ID 0 is showing error page',
    );
    expect(getFrame).toHaveBeenCalledWith({ tabId: 12, frameId: 0 });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('recognizes Chrome content-script disconnect errors', () => {
    expect(isContentScriptDisconnectedError(new Error('Could not establish connection.'))).toBe(
      true,
    );
    expect(
      isContentScriptDisconnectedError(
        new Error('A listener indicated an asynchronous response by returning true'),
      ),
    ).toBe(true);
    expect(isContentScriptDisconnectedError(new Error('Target tab 12 not found'))).toBe(false);
    expect(
      isContentScriptMessageTimeoutError(new Error('Message action getPageText timed out')),
    ).toBe(true);
  });

  it('retries a read-only content-script timeout once', async () => {
    const sendMessage = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;
    const executeScript = vi.fn();
    (chrome.tabs.get as any).mockResolvedValue({
      id: 12,
      url: 'https://example.com',
      status: 'complete',
    });
    (chrome.scripting as any) = { executeScript };
    sendMessage
      .mockRejectedValueOnce(new Error('Message action getPageText timed out'))
      .mockResolvedValueOnce({ status: 'pong' })
      .mockResolvedValueOnce({ success: true, text: 'ok' });

    const tool = new TestBrowserTool();
    await expect(
      tool.sendRead(12, { action: 'getPageText' }, ['inject-scripts/web-fetcher-helper.js']),
    ).resolves.toMatchObject({ success: true, text: 'ok' });
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('does not retry a timed-out message through the base send path', async () => {
    const sendMessage = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockRejectedValue(new Error('Message action clickElement timed out'));
    const tool = new TestBrowserTool();

    await expect(tool.send(12, { action: 'clickElement' })).rejects.toThrow(
      'Message action clickElement timed out',
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('uses a 30-second default and clamps the configurable content timeout', () => {
    expect(normalizeContentMessageTimeoutMs(undefined)).toBe(30_000);
    expect(normalizeContentMessageTimeoutMs(60_000)).toBe(60_000);
    expect(normalizeContentMessageTimeoutMs(1_000)).toBe(5_000);
    expect(normalizeContentMessageTimeoutMs(999_000)).toBe(300_000);
  });
});
