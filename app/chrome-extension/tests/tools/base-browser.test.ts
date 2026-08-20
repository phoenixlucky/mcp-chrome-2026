import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseBrowserToolExecutor } from '@/entrypoints/background/tools/base-browser';
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
}

describe('BaseBrowserToolExecutor target tab resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
