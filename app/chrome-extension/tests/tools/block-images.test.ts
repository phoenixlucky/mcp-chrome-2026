import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockImagesTool } from '@/entrypoints/background/tools/browser/block-images';

describe('chrome_block_images', () => {
  beforeEach(() => {
    (chrome.tabs.get as any).mockResolvedValue({ id: 42, url: 'https://example.com' });
    (chrome.debugger.getTargets as any).mockResolvedValue([]);
    (chrome.debugger.attach as any).mockResolvedValue(undefined);
    (chrome.debugger.detach as any).mockResolvedValue(undefined);
    (chrome.debugger.sendCommand as any).mockResolvedValue({});
  });

  afterEach(async () => {
    await blockImagesTool.execute({ action: 'stop', tabId: 42 });
  });

  it('enables Fetch interception before navigation and disables it on stop', async () => {
    await blockImagesTool.execute({ action: 'start', tabId: 42 });

    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith({ tabId: 42 }, 'Fetch.enable', {
      patterns: [{ resourceType: 'Image', requestStage: 'Request' }],
    });

    await blockImagesTool.execute({ action: 'stop', tabId: 42 });

    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Fetch.disable',
      undefined,
    );
  });

  it('refuses a browser-internal tab instead of falling back to the active page', async () => {
    (chrome.tabs.get as any).mockResolvedValue({ id: 42, url: 'chrome://extensions/' });

    const result = await blockImagesTool.execute({ action: 'start', tabId: 42 });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Pass the collector page tabId');
    expect(chrome.debugger.sendCommand).not.toHaveBeenCalledWith(
      { tabId: 42 },
      'Fetch.enable',
      expect.anything(),
    );
  });

  it('falls back to the active tab when the requested tab was closed', async () => {
    (chrome.tabs.get as any).mockRejectedValue(new Error('No tab with id: 42.'));
    (chrome.tabs.query as any).mockResolvedValue([{ id: 43, url: 'https://example.com' }]);

    const result = await blockImagesTool.execute({ action: 'start', tabId: 42 });

    expect(result.isError).toBe(false);
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith({ tabId: 43 }, 'Fetch.enable', {
      patterns: [{ resourceType: 'Image', requestStage: 'Request' }],
    });
  });
});
