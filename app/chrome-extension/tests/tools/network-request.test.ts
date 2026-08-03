import { beforeEach, describe, expect, it, vi } from 'vitest';
import { networkRequestTool } from '@/entrypoints/background/tools/browser/network-request';

describe('network request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('explains why Chrome internal pages cannot send requests', async () => {
    (chrome.tabs.query as any).mockResolvedValue([{ id: 1, url: 'chrome://newtab/' }]);

    const result = await networkRequestTool.execute({ url: 'https://ip.oxylabs.io/location' });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Chrome 内置页'),
    });
  });
});
