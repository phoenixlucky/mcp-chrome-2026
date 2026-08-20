import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webFetcherTool } from '@/entrypoints/background/tools/browser/web-fetcher';

describe('web fetcher navigation recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (chrome.webNavigation as any).getFrame = vi.fn();
    (chrome.scripting as any) = { executeScript: vi.fn().mockResolvedValue([]) };
    (chrome.tabs as any).sendMessage = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-navigates a URL-backed tab when its navigation ends on an error page', async () => {
    const getTab = chrome.tabs.get as unknown as ReturnType<typeof vi.fn>;
    const updateTab = chrome.tabs.update as unknown as ReturnType<typeof vi.fn>;
    const createTab = chrome.tabs.create as unknown as ReturnType<typeof vi.fn>;
    const queryTabs = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    const getFrame = (chrome.webNavigation as any).getFrame as ReturnType<typeof vi.fn>;
    const sendMessage = (chrome.tabs as any).sendMessage as ReturnType<typeof vi.fn>;

    createTab.mockResolvedValue({
      id: 42,
      windowId: 7,
      url: 'https://example.com/article',
      status: 'loading',
    });
    queryTabs.mockResolvedValue([]);
    getTab.mockResolvedValue({
      id: 42,
      windowId: 7,
      url: 'https://example.com/article',
      status: 'complete',
      title: 'Article',
    });
    getFrame
      .mockResolvedValueOnce({ errorOccurred: true })
      .mockResolvedValue({ errorOccurred: false });
    sendMessage.mockImplementation((_tabId: number, message: { action: string }) => {
      if (message.action.endsWith('_ping')) return Promise.reject(new Error('not injected'));
      return Promise.resolve({ success: true, textContent: 'article text' });
    });

    const request = webFetcherTool.execute({ url: 'https://example.com/article' });
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await request;

    expect(updateTab).toHaveBeenCalledWith(42, { url: 'https://example.com/article' });
    expect((chrome.scripting as any).executeScript).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(false);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('article text'),
    });
  });

  it('does not replace an explicit tab when it has already been closed', async () => {
    const getTab = chrome.tabs.get as unknown as ReturnType<typeof vi.fn>;
    const queryTabs = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    getTab.mockRejectedValue(new Error('No tab with id: 42'));
    queryTabs.mockResolvedValue([{ id: 7, active: true }]);

    const result = await webFetcherTool.execute({ tabId: 42 });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('No tab with id: 42'),
    });
    expect(queryTabs).not.toHaveBeenCalled();
  });
});
