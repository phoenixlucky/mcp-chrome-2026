import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendCommand } = vi.hoisted(() => ({ sendCommand: vi.fn() }));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    withSession: vi.fn((_tabId: number, _key: string, run: () => unknown) => run()),
    sendCommand,
  },
}));

import { pasteImageTool } from '@/entrypoints/background/tools/browser/paste-image';

function text(result: { content: Array<{ type: string; text?: string }> }) {
  const content = result.content[0];
  if (content?.type !== 'text' || typeof content.text !== 'string')
    throw new Error('Expected a text tool result');
  return content.text;
}

describe('chrome_paste_image', () => {
  beforeEach(() => {
    sendCommand.mockReset();
    (chrome.tabs.get as any).mockResolvedValue({
      id: 12,
      url: 'https://github.com/example/repo/issues/1',
    });
    sendCommand.mockImplementation(async (_tabId: number, method: string) => {
      if (method === 'DOM.getDocument') return { root: { nodeId: 1 } };
      if (method === 'DOM.querySelector') return { nodeId: 2 };
      if (method === 'Runtime.evaluate') {
        const call = sendCommand.mock.calls.at(-1);
        const expression = String(call?.[2]?.expression || '');
        if (expression.includes('document.createElement')) return { result: { value: true } };
        if (expression.includes("ClipboardEvent('paste'")) {
          return {
            result: {
              value: {
                success: true,
                dispatched: true,
                target: { tagName: 'TEXTAREA', id: 'comment', className: '' },
                file: { name: 'screen.png', type: 'image/png', size: 12 },
              },
            },
          };
        }
        return { result: { value: true } };
      }
      return {};
    });
  });

  it('sets a local file on a temporary input and dispatches a file paste event', async () => {
    const result = await pasteImageTool.execute({
      filePath: 'C:\\tmp\\screen.png',
      targetSelector: '#comment',
      tabId: 12,
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(text(result))).toMatchObject({
      success: true,
      dispatched: true,
      file: { name: 'screen.png', type: 'image/png' },
    });
    expect(sendCommand.mock.calls.some(([, method]) => method === 'DOM.setFileInputFiles')).toBe(
      true,
    );
    const pasteExpression = sendCommand.mock.calls
      .map(([, , params]) => params?.expression || '')
      .find((expression: string) => expression.includes("ClipboardEvent('paste'"));
    expect(pasteExpression).toContain('new DataTransfer()');
  });

  it('requires exactly one image source', async () => {
    const result = await pasteImageTool.execute({ tabId: 12 });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('exactly one');
  });
});
