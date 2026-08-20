import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { networkRequestTool } from '@/entrypoints/background/tools/browser/network-request';

describe('network request', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('explains why Chrome internal pages cannot send requests', async () => {
    (chrome.tabs.query as any).mockResolvedValue([{ id: 1, url: 'chrome://newtab/' }]);

    const result = await networkRequestTool.execute({ url: 'https://ip.oxylabs.io/location' });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Chrome 内置页'),
    });
  });

  it('uses the extension fetch path for cross-origin requests', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, url: 'https://app.example.com/dashboard' },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {
        forEach: (callback: (value: string, key: string) => void) =>
          callback('application/json', 'content-type'),
        get: () => 'application/json',
      },
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await networkRequestTool.execute({
      url: 'https://api.example.com/data',
      headers: { Cookie: 'session=secret', 'X-Test': 'kept' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/data');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'X-Test': 'kept' });
    expect(result.isError).toBe(false);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('"ok":true'),
    });
  });
});
