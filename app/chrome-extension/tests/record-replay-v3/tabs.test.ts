import { describe, expect, it, vi } from 'vitest';
import {
  openTabHandler,
  switchTabHandler,
} from '@/entrypoints/background/record-replay-v3/actions/handlers/tabs';

describe('recorded tab links', () => {
  it('keeps replaying after a redirected _blank link', async () => {
    vi.stubGlobal('chrome', {
      tabs: {
        create: vi.fn(async () => ({ id: 2 })),
        get: vi.fn(async () => ({ id: 2, status: 'complete' })),
        query: vi.fn(async () => [{ id: 2, url: 'https://final.example/' }]),
        update: vi.fn(async () => ({})),
      },
      windows: { update: vi.fn(async () => ({})) },
    });
    const ctx = { tabId: 1, vars: {} } as any;
    const url = 'https://www.baidu.com/link?url=redirected';
    const opened = await openTabHandler.run(ctx, { params: { url } } as any);

    ctx.tabId = opened.newTabId;
    const switched = await switchTabHandler.run(ctx, { params: { urlContains: url } } as any);

    expect(switched).toMatchObject({ status: 'success', newTabId: 2 });
  });
});
