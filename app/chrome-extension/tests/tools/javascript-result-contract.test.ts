import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendCommand } = vi.hoisted(() => ({ sendCommand: vi.fn() }));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    withSession: vi.fn((_tabId: number, _key: string, run: () => unknown) => run()),
    sendCommand,
  },
}));

import { javascriptTool } from '@/entrypoints/background/tools/browser/javascript';
import { scrollStateTool, scrollTool } from '@/entrypoints/background/tools/browser/scroll';

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

  it('uses the same anchored container resolver for scroll and state', async () => {
    sendCommand
      .mockResolvedValueOnce({
        result: {
          value: JSON.stringify({
            success: true,
            target: '[data-testid="primaryColumn"]',
            moved: true,
            scrollTop: 600,
            scrollHeight: 1800,
            clientHeight: 900,
            scrollLeft: 0,
            scrollWidth: 900,
            clientWidth: 900,
          }),
        },
      })
      .mockResolvedValueOnce({
        result: {
          value: JSON.stringify({
            success: true,
            target: '[data-testid="primaryColumn"]',
            y: 600,
            maxY: 900,
            atTop: false,
            atBottom: false,
          }),
        },
      });

    const args = { tabId: 12, anchorSelector: '[data-testid="cellInnerDiv"]' };
    const scroll = await scrollTool.execute({ ...args, amount: 300 });
    const state = await scrollStateTool.execute(args);
    const expressions = sendCommand.mock.calls.map(([, , params]) => params.expression);

    expect(expressions).toHaveLength(2);
    expressions.forEach((expression) => {
      expect(expression).toContain('doc.querySelectorAll("[data-testid=\\"cellInnerDiv\\"]")');
      expect(expression).toContain('win.__mcpChromeScrollRoot');
    });
    expect(JSON.parse(scroll.content[0].text)).toMatchObject({
      target: '[data-testid="primaryColumn"]',
      moved: true,
    });
    expect(JSON.parse(state.content[0].text)).toMatchObject({
      target: '[data-testid="primaryColumn"]',
      y: 600,
    });
  });
});
