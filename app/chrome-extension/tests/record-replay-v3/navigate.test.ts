import { describe, expect, it, vi } from 'vitest';

vi.mock('@/entrypoints/background/tools', () => ({ handleCallTool: vi.fn() }));

import { handleCallTool } from '@/entrypoints/background/tools';
import { navigateHandler } from '@/entrypoints/background/record-replay-v3/actions/handlers/navigate';

describe('navigateHandler', () => {
  it('uses the navigation tool result without a second, stale navigation wait', async () => {
    vi.mocked(handleCallTool).mockResolvedValue({ isError: false } as any);

    const result = await navigateHandler.run(
      { tabId: 17, vars: {} } as any,
      { params: { url: 'https://linkfox.ai/usercenter/orderList' } } as any,
    );

    expect(result).toEqual({ status: 'success' });
    expect(handleCallTool).toHaveBeenCalledWith({
      name: 'chrome_navigate',
      args: { url: 'https://linkfox.ai/usercenter/orderList', tabId: 17 },
    });
  });
});
