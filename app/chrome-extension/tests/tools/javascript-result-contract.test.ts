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
  return JSON.parse(text(result));
}

function text(result: { content: Array<{ type: string; text?: string }> }) {
  const content = result.content[0];
  if (content?.type !== 'text' || typeof content.text !== 'string')
    throw new Error('Expected a text tool result');
  return content.text;
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
    expect(JSON.parse(text(result))).toEqual({
      target: '#primaryColumn',
      y: 400,
      maxY: 1200,
      atTop: false,
      atBottom: false,
      success: true,
    });
  });

  it('uses the same anchored container resolver for scroll and state', async () => {
    sendCommand.mockImplementation(async (_tabId, method, params) => {
      if (method === 'Input.dispatchMouseEvent') return {};
      if (params.expression.includes('maxY')) {
        return {
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
        };
      }
      return {
        result: {
          value: JSON.stringify({
            success: true,
            target: '[data-testid="primaryColumn"]',
            x: 100,
            y: 100,
            moved: true,
            scrollTop: params.expression.includes('scrollWidth') ? 600 : 0,
            scrollHeight: 1800,
            clientHeight: 900,
            scrollLeft: 0,
            scrollWidth: 900,
            clientWidth: 900,
          }),
        },
      };
    });

    const args = { tabId: 12, anchorSelector: '[data-testid="cellInnerDiv"]' };
    const scroll = await scrollTool.execute({ ...args, amount: 300 });
    const state = await scrollStateTool.execute(args);
    const expressions = sendCommand.mock.calls
      .map(([, , params]) => params?.expression)
      .filter((expression): expression is string => typeof expression === 'string');

    expect(expressions).toHaveLength(3);
    expressions.forEach((expression) => {
      expect(expression).toContain('doc.querySelectorAll("[data-testid=\\"cellInnerDiv\\"]")');
      expect(expression).toContain('win.__mcpChromeScrollRoot');
    });
    expect(JSON.parse(text(scroll))).toMatchObject({
      target: '[data-testid="primaryColumn"]',
      moved: true,
    });
    expect(JSON.parse(text(state))).toMatchObject({
      target: '[data-testid="primaryColumn"]',
      y: 600,
    });
  });

  it('builds paced pixel scrolling when steps and intervalMs are provided', async () => {
    sendCommand.mockImplementation(async (_tabId, method) => {
      if (method === 'Input.dispatchMouseEvent') return {};
      return {
        result: {
          value: JSON.stringify({
            success: true,
            target: 'document.scrollingElement',
            x: 500,
            y: 450,
            moved: true,
            scrollTop: 1000,
            scrollHeight: 2000,
            clientHeight: 900,
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 1000,
          }),
        },
      };
    });

    await scrollTool.execute({
      tabId: 12,
      amount: 1000,
      direction: 'down',
      steps: 10,
      intervalMs: 150,
    });

    const wheelCalls = sendCommand.mock.calls.filter(
      ([, method]) => method === 'Input.dispatchMouseEvent',
    );
    expect(wheelCalls).toHaveLength(10);
    expect(wheelCalls[0][2]).toMatchObject({ type: 'mouseWheel', x: 500, y: 450 });
    expect(wheelCalls[0][2].deltaY).toBeGreaterThan(wheelCalls[9][2].deltaY);
    expect(wheelCalls.reduce((sum, [, , params]) => sum + params.deltaY, 0)).toBeCloseTo(1000);
  });

  it('auto-scales human pacing and accepts explicit overrides', async () => {
    sendCommand.mockImplementation(async (_tabId, method) => {
      if (method === 'Input.dispatchMouseEvent') return {};
      return {
        result: {
          value: JSON.stringify({
            success: true,
            target: 'document.scrollingElement',
            x: 500,
            y: 450,
            moved: true,
            scrollTop: 1000,
            scrollHeight: 2000,
            clientHeight: 900,
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 1000,
          }),
        },
      };
    });

    await scrollTool.execute({ tabId: 12, mode: 'human', amount: 300 });
    let wheelCalls = sendCommand.mock.calls.filter(
      ([, method]) => method === 'Input.dispatchMouseEvent',
    );
    expect(wheelCalls).toHaveLength(8);
    expect(wheelCalls.reduce((sum, [, , params]) => sum + params.deltaY, 0)).toBeCloseTo(300);

    sendCommand.mockClear();
    await scrollTool.execute({ tabId: 12, mode: 'human', amount: 600, steps: 3, intervalMs: 10 });
    wheelCalls = sendCommand.mock.calls.filter(
      ([, method]) => method === 'Input.dispatchMouseEvent',
    );
    expect(wheelCalls).toHaveLength(3);
  });

  it('uses the standard, fast-human, and slow-human pacing profiles', async () => {
    sendCommand.mockImplementation(async (_tabId, method) => {
      if (method === 'Input.dispatchMouseEvent') return {};
      return {
        result: {
          value: JSON.stringify({
            success: true,
            target: 'document.scrollingElement',
            x: 500,
            y: 450,
            moved: true,
            scrollTop: 1000,
            scrollHeight: 2000,
            clientHeight: 900,
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 1000,
          }),
        },
      };
    });

    const intervals = { human: 50, humanFast: 20, humanSlow: 80 } as const;
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    for (const mode of ['human', 'humanFast', 'humanSlow'] as const) {
      sendCommand.mockClear();
      timeoutSpy.mockClear();
      await scrollTool.execute({ tabId: 12, mode, amount: 600 });
      expect(
        sendCommand.mock.calls.filter(([, method]) => method === 'Input.dispatchMouseEvent'),
      ).toHaveLength(15);
      expect(timeoutSpy.mock.calls.filter(([, delay]) => delay === intervals[mode])).toHaveLength(
        14,
      );
    }

    timeoutSpy.mockRestore();
  });

  it('checks human lazy-load once per paced scroll round', async () => {
    sendCommand.mockClear();
    sendCommand.mockImplementation(async (_tabId, method) => {
      if (method === 'Input.dispatchMouseEvent') return {};
      return {
        result: {
          value: JSON.stringify({
            success: true,
            target: 'document.scrollingElement',
            x: 500,
            y: 450,
            moved: true,
            scrollTop: 1000,
            scrollHeight: 2000,
            clientHeight: 900,
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 1000,
          }),
        },
      };
    });

    await scrollTool.execute({
      tabId: 12,
      mode: 'human',
      amount: 120,
      steps: 2,
      humanLazyLoad: true,
    });

    const expressions = sendCommand.mock.calls
      .map(([, , params]) => params?.expression)
      .filter((expression): expression is string => typeof expression === 'string');
    expect(
      expressions.filter((expression) => expression.includes('MutationObserver')),
    ).toHaveLength(1);
    expect(
      expressions.filter((expression) => expression.includes('PerformanceObserver')),
    ).toHaveLength(1);
    expect(
      sendCommand.mock.calls.filter(([, method]) => method === 'Input.dispatchMouseEvent'),
    ).toHaveLength(2);
  });

  it('keeps scrolling to a stable bottom in human toBottom mode', async () => {
    sendCommand.mockClear();
    let scrollTop = 0;
    sendCommand.mockImplementation(async (_tabId, method, params) => {
      if (method === 'Input.dispatchMouseEvent') {
        scrollTop = Math.min(600, scrollTop + Math.max(0, params.deltaY));
        return {};
      }
      const expression = params?.expression || '';
      const state = expression.includes('getBoundingClientRect')
        ? {
            success: true,
            x: 500,
            y: 450,
            scrollTop,
            scrollLeft: 0,
          }
        : {
            success: true,
            target: 'document.scrollingElement',
            scrollTop,
            scrollHeight: 1500,
            clientHeight: 900,
            scrollLeft: 0,
            scrollWidth: 1000,
            clientWidth: 1000,
          };
      return { result: { value: JSON.stringify(state) } };
    });

    const result = await scrollTool.execute({
      tabId: 12,
      mode: 'human',
      toBottom: true,
      amount: 600,
      steps: 2,
      intervalMs: 0,
    });

    expect(JSON.parse(text(result))).toMatchObject({ atBottom: true, scrollTop: 600 });
    expect(
      sendCommand.mock.calls.filter(([, method]) => method === 'Input.dispatchMouseEvent'),
    ).toHaveLength(6);
  });
});
