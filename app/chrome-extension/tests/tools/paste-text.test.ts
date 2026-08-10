import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendCommand } = vi.hoisted(() => ({ sendCommand: vi.fn() }));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    withSession: vi.fn((_tabId: number, _key: string, run: () => unknown) => run()),
    sendCommand,
  },
}));

import { pasteTextTool } from '@/entrypoints/background/tools/browser/paste-text';

function text(result: { content: Array<{ type: string; text?: string }> }) {
  const content = result.content[0];
  if (content?.type !== 'text' || typeof content.text !== 'string')
    throw new Error('Expected a text tool result');
  return content.text;
}

function expressionOf(call: unknown[]): string {
  const params = call[2] as { expression?: string };
  if (typeof params?.expression !== 'string')
    throw new Error('Expected Runtime.evaluate expression');
  return params.expression;
}

describe('paste-text tool', () => {
  beforeEach(() => {
    sendCommand.mockReset();
    (chrome.tabs.get as any).mockResolvedValue({ id: 12, url: 'https://www.zhihu.com/question/1' });
    (chrome as any).scripting = { executeScript: vi.fn() };
  });

  it('rejects when text is missing', async () => {
    const result = await pasteTextTool.execute({} as any);
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('[text] is required');
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('dispatches a synthesized paste event with a DataTransfer', async () => {
    sendCommand.mockResolvedValue({
      result: {
        value: {
          ok: true,
          dispatched: true,
          editor: 'DIV.RichText',
          length: 42,
          blockCount: 5,
        },
      },
    });

    const result = await pasteTextTool.execute({
      text: '第一段\n\n第二段',
      tabId: 12,
    });

    const expression = expressionOf(sendCommand.mock.calls[0]);
    expect(expression).toContain("new ClipboardEvent('paste'");
    expect(expression).toContain("dt.setData('text/plain'");
    expect(expression).toContain('[contenteditable="true"]');
    // 文本以 JSON 转义嵌入，避免拼接注入
    expect(expression).toContain(JSON.stringify('第一段\n\n第二段'));
    expect(expression).not.toContain('第一段\n\n第二段'); // 原始换行不直接出现

    expect(JSON.parse(text(result))).toMatchObject({
      success: true,
      tabId: 12,
      engine: 'cdp',
      dispatched: true,
      blockCount: 5,
      length: 42,
    });
  });

  it('prefers the provided selector and counts Draft.js blocks', async () => {
    sendCommand.mockResolvedValue({
      result: {
        value: { ok: true, dispatched: true, editor: 'DIV.RichText', length: 18, blockCount: 18 },
      },
    });

    await pasteTextTool.execute({
      text: '一\n\n二\n\n三',
      selector: '.DraftEditor-root [contenteditable="true"]',
      tabId: 12,
    });

    const expression = expressionOf(sendCommand.mock.calls[0]);
    expect(expression).toContain('.DraftEditor-block');
    expect(expression).toContain(JSON.stringify('.DraftEditor-root [contenteditable="true"]'));
  });

  it('falls back to a MAIN-world scripting injection when the debugger is busy', async () => {
    sendCommand.mockRejectedValue(new Error('Another debugger is already attached'));
    (chrome.scripting as any).executeScript = vi
      .fn()
      .mockResolvedValue([
        { result: { ok: true, dispatched: true, editor: 'DIV', length: 4, blockCount: 1 } },
      ]);

    const result = await pasteTextTool.execute({
      text: '喵',
      selector: '[contenteditable="true"]',
      tabId: 12,
    });

    expect(JSON.parse(text(result))).toMatchObject({ success: true, engine: 'scripting' });
    const run = (chrome.scripting as any).executeScript.mock.calls[0][0];
    expect(run.world).toBe('MAIN');
    expect(run.target).toEqual({ tabId: 12 });
  });

  it('surfaces a page-side rejection as an error', async () => {
    sendCommand.mockResolvedValue({
      result: {
        value: {
          ok: false,
          error: 'No editable element found (pass a selector to target the editor)',
        },
      },
    });

    const result = await pasteTextTool.execute({ text: 'x', tabId: 12 });
    expect(result.isError).toBe(true);
    expect(JSON.parse(text(result))).toMatchObject({ success: false, tabId: 12 });
  });

  it('returns a CDP error when evaluation fails for a non-conflict reason', async () => {
    sendCommand.mockRejectedValue(new Error('Runtime.evaluate failed: unexpected'));
    (chrome.scripting as any).executeScript = vi.fn();

    const result = await pasteTextTool.execute({ text: 'x', tabId: 12 });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('Paste failed');
    expect((chrome.scripting as any).executeScript).not.toHaveBeenCalled();
  });
});
