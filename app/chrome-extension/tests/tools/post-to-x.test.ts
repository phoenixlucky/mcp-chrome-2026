import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clickExecute, fillExecute, waitExecute } = vi.hoisted(() => ({
  clickExecute: vi.fn(),
  fillExecute: vi.fn(),
  waitExecute: vi.fn(),
}));

vi.mock('@/entrypoints/background/tools/browser/interaction', () => ({
  clickTool: { execute: clickExecute },
  fillTool: { execute: fillExecute },
}));

vi.mock('@/entrypoints/background/tools/browser/wait', () => ({
  waitTool: { execute: waitExecute },
}));

import { postToXTool } from '@/entrypoints/background/tools/browser/post-to-x';

function payload(result: { content: Array<{ type: string; text?: string }> }) {
  const content = result.content[0];
  if (content?.type !== 'text' || typeof content.text !== 'string') {
    throw new Error('Expected a text tool result');
  }
  return JSON.parse(content.text);
}

describe('chrome_post_to_x', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chrome.tabs.get as any).mockResolvedValue({ id: 42, url: 'https://x.com/home' });
    (chrome.scripting as any) = {
      executeScript: vi.fn().mockResolvedValue([{ result: { count: 0, texts: [] } }]),
    };
    waitExecute
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"found":true}' }],
        isError: false,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"found":true}' }],
        isError: false,
      })
      .mockResolvedValue({ content: [{ type: 'text', text: '{"found":false}' }], isError: false });
    fillExecute.mockResolvedValue({
      content: [{ type: 'text', text: '{"elementInfo":{"value":"hello"}}' }],
      isError: false,
    });
    clickExecute.mockResolvedValue({
      content: [{ type: 'text', text: '{"success":true,"clicked":true}' }],
      isError: false,
    });
  });

  it('returns unknown after a successful click without confirmation and never retries', async () => {
    const result = await postToXTool.execute({ text: 'hello', tabId: 42, timeout: 1_000 });

    expect(result.isError).toBe(false);
    expect(payload(result)).toMatchObject({
      status: 'unknown',
      clicked: true,
      retryRecommended: false,
    });
    expect(clickExecute).toHaveBeenCalledTimes(1);
  });

  it('rejects non-X tabs before any write operation', async () => {
    (chrome.tabs.get as any).mockResolvedValue({ id: 42, url: 'https://example.com' });

    const result = await postToXTool.execute({ text: 'hello', tabId: 42 });

    expect(result.isError).toBe(true);
    expect(clickExecute).not.toHaveBeenCalled();
    expect(fillExecute).not.toHaveBeenCalled();
  });
});
