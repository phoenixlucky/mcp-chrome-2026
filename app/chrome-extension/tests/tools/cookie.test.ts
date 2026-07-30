import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cookieDeleteTool,
  cookieGetTool,
  cookieSetTool,
} from '@/entrypoints/background/tools/browser/cookie';

const getAll = vi.fn();
const set = vi.fn();
const remove = vi.fn();
const cookie = {
  name: 'session',
  value: 'token',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'lax',
  session: true,
  storeId: '0',
  hostOnly: false,
};

describe('cookie tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.chrome as any).cookies = { getAll, set, remove };
  });

  it('gets, sets, and deletes cookies through Chrome cookie APIs', async () => {
    getAll.mockResolvedValue([cookie]);
    set.mockResolvedValue(cookie);
    remove.mockResolvedValue({ url: 'https://example.com/', name: 'session', storeId: '0' });

    const found = await cookieGetTool.execute({ domain: 'example.com' });
    await cookieSetTool.execute({
      url: 'https://example.com/',
      name: 'session',
      value: 'token',
      httpOnly: true,
    });
    const deleted = await cookieDeleteTool.execute({
      url: 'https://example.com/',
      name: 'session',
    });

    expect(getAll).toHaveBeenCalledWith({ domain: 'example.com' });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: 'session', httpOnly: true }));
    expect(remove).toHaveBeenCalledWith({ url: 'https://example.com/', name: 'session' });
    expect(JSON.parse((found.content[0] as { text: string }).text)).toEqual({
      cookies: [expect.objectContaining({ httpOnly: true, value: 'token' })],
    });
    expect(JSON.parse((deleted.content[0] as { text: string }).text)).toMatchObject({
      deleted: true,
    });
  });
});
