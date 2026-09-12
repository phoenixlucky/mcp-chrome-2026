import { beforeEach, describe, expect, it, vi } from 'vitest';

const { withSession, sendCommand } = vi.hoisted(() => ({
  withSession: vi.fn(),
  sendCommand: vi.fn(),
}));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: { withSession, sendCommand },
}));

import {
  expandSectionTool,
  findAndClickTool,
} from '@/entrypoints/background/tools/browser/review-tools';

function payload(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content[0];
  if (text?.type !== 'text' || typeof text.text !== 'string')
    throw new Error('Expected text result');
  return JSON.parse(text.text);
}

describe('review tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSession.mockImplementation(async (_tabId: number, _owner: string, run: () => unknown) =>
      run(),
    );
    (chrome.tabs.get as any).mockResolvedValue({ id: 42, windowId: 7, url: 'https://x.com/home' });
  });

  it('evaluates find-and-click as an async page IIFE', async () => {
    sendCommand.mockResolvedValue({
      result: {
        value: { success: true, clicked: true, matchedCandidate: 0, matchedCount: 1 },
      },
    });

    const result = await findAndClickTool.execute({
      tabId: 42,
      candidates: [{ selector: 'button' }],
      waitTimeout: 0,
    });

    expect(payload(result)).toMatchObject({ success: true, clicked: true });
    expect(sendCommand.mock.calls[0][2].expression).toContain('(async () => {');
  });

  it('preserves page exception details instead of returning only Uncaught', async () => {
    sendCommand.mockResolvedValue({
      exceptionDetails: {
        text: 'Uncaught',
        exception: { description: 'SyntaxError: await is only valid in async functions' },
        stackTrace: {
          callFrames: [
            {
              functionName: '<anonymous>',
              url: 'https://x.com/home',
              lineNumber: 12,
              columnNumber: 3,
            },
          ],
        },
      },
    });

    const result = await findAndClickTool.execute({
      tabId: 42,
      candidates: [{ selector: 'button' }],
    });

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('SyntaxError: await is only valid in async functions');
    expect(payload(result).reason).toContain('https://x.com/home:13:4');
  });

  it('returns the detailed click failure through expand-section', async () => {
    sendCommand
      .mockResolvedValueOnce({
        result: { value: { matched: true, pending: true, expanded: false } },
      })
      .mockResolvedValueOnce({
        exceptionDetails: {
          text: 'Uncaught',
          exception: { description: 'TypeError: click failed' },
        },
      });

    const result = await expandSectionTool.execute({
      tabId: 42,
      trigger: { candidates: [{ selector: 'button' }] },
      contentSelector: '[data-expanded-content]',
      waitTimeout: 0,
    });

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('TypeError: click failed');
  });
});
