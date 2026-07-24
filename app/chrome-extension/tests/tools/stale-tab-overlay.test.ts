import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@/entrypoints/background/tools/browser', () => ({
  navigateTool: { name: 'chrome_navigate', execute },
}));
vi.mock('@/entrypoints/background/tools/record-replay', () => ({
  flowRunTool: { name: 'record_replay_flow_run', execute: vi.fn() },
  listPublishedFlowsTool: { name: 'record_replay_list_published', execute: vi.fn() },
}));

import { handleCallTool } from '@/entrypoints/background/tools';

describe('stale tab operation overlay', () => {
  beforeEach(() => {
    execute.mockResolvedValue({ content: [], isError: false });
    (chrome.storage.local.get as any).mockResolvedValue({ backgroundOperations: true });
    (chrome.tabs.get as any).mockRejectedValue(new Error('No tab with id: 1.'));
  });

  it('does not block navigation when the status overlay targets a closed tab', async () => {
    await handleCallTool({
      name: 'chrome_navigate',
      args: { tabId: 1, url: 'https://example.com' },
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 1, url: 'https://example.com' }),
      undefined,
    );
  });
});
