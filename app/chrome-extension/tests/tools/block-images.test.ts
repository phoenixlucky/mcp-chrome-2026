import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockImagesTool } from '@/entrypoints/background/tools/browser/block-images';

describe('chrome_block_images', () => {
  beforeEach(() => {
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
});
