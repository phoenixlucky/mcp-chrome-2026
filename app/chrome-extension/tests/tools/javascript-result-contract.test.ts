import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendCommand } = vi.hoisted(() => ({ sendCommand: vi.fn() }));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    withSession: vi.fn((_tabId: number, _key: string, run: () => unknown) => run()),
    sendCommand,
  },
}));

import { javascriptTool } from '@/entrypoints/background/tools/browser/javascript';
import { scrollStateTool } from '@/entrypoints/background/tools/browser/scroll';

function payload(result: Awaited<ReturnType<typeof javascriptTool.execute>>) {
  return JSON.parse(result.content[0].text);
}

describe('browser result contracts', () => {
  beforeEach(() => {
    (chrome.tabs.get as any).mockResolvedValue({ id: 12, url: 'https://example.com/page' });
  });

  it('rejects undefined only when chrome_javascript requires a result', async () => {
    sendCommand.mockResolvedValue({ result: { type: 'undefined' } });

    const noResult = await javascriptTool.execute({
      code: 'document.body.click()',
      tabId: 12,
      requireResult: true,
    });
    expect(payload(noResult)).toMatchObject({
      success: false,
      returned: false,
      tabId: 12,
      url: 'https://example.com/page',
      engine: 'cdp',
      error: { kind: 'no_result' },
    });

    const actionOnly = await javascriptTool.execute({ code: 'document.body.click()', tabId: 12 });
    expect(payload(actionOnly)).toMatchObject({ success: true, returned: false });
  });

  it('keeps a returned zero distinct from undefined', async () => {
    sendCommand.mockResolvedValue({ result: { type: 'number', value: 0 } });

    const result = await javascriptTool.execute({
      code: 'return 0',
      tabId: 12,
      requireResult: true,
    });
    expect(payload(result)).toMatchObject({ success: true, returned: true, result: '0' });
  });

  it('returns native scroll state without a caller-provided script', async () => {
    sendCommand.mockResolvedValue({
      result: {
        value: JSON.stringify({
          target: '#primaryColumn',
          y: 400,
          maxY: 1200,
          atTop: false,
          atBottom: false,
          success: true,
        }),
      },
    });

    const result = await scrollStateTool.execute({ tabId: 12 });
    expect(JSON.parse(result.content[0].text)).toEqual({
      target: '#primaryColumn',
      y: 400,
      maxY: 1200,
      atTop: false,
      atBottom: false,
      success: true,
    });
  });
});
