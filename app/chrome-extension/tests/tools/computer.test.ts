import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computerTool } from '@/entrypoints/background/tools/browser/computer';

const chromeApi = globalThis.chrome as any;

function resultValue(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('computer hover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeApi.tabs.get.mockResolvedValue({
      id: 7,
      windowId: 3,
      url: 'https://example.com',
      active: false,
    });
    chromeApi.windows.get.mockResolvedValue({ id: 3, state: 'minimized' });
    chromeApi.debugger.getTargets.mockResolvedValue([]);
    chromeApi.debugger.attach.mockResolvedValue(undefined);
    chromeApi.debugger.detach.mockResolvedValue(undefined);
  });

  it('uses the DOM hover helper for selector targets in a minimized window', async () => {
    const inject = vi
      .spyOn(computerTool as any, 'injectContentScript')
      .mockResolvedValue(undefined);
    const send = vi
      .spyOn(computerTool as any, 'sendMessageToTab')
      .mockImplementation(async (_tabId: any, message: any) => {
        if (message.action === 'locateElement') {
          return { success: true, ref: 'ref_menu', point: { x: 20, y: 30 } };
        }
        return { success: true, target: { tagName: 'BUTTON' } };
      });

    const result = await computerTool.execute({
      action: 'hover',
      tabId: 7,
      selector: '#menu',
      duration: 0,
    });

    expect(resultValue(result)).toMatchObject({
      success: true,
      action: 'hover',
      transport: 'dom-ref',
    });
    expect(inject).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(chromeApi.debugger.sendCommand).not.toHaveBeenCalled();
  });

  it('keeps coordinate hover retryable when the window is minimized', async () => {
    const result = await computerTool.execute({
      action: 'hover',
      tabId: 7,
      coordinates: { x: 20, y: 30 },
    });

    expect(resultValue(result)).toMatchObject({
      success: false,
      code: 'FOREGROUND_REQUIRED',
      retryable: true,
    });
    expect(chromeApi.debugger.sendCommand).not.toHaveBeenCalled();
  });

  it('preserves the DOM helper error when hover fallback cannot run', async () => {
    vi.spyOn(computerTool as any, 'injectContentScript').mockResolvedValue(undefined);
    vi.spyOn(computerTool as any, 'sendMessageToTab').mockImplementation(
      async (_tabId: any, message: any) => {
        if (message.action === 'locateElement') {
          return { success: true, ref: 'ref_menu', point: { x: 20, y: 30 } };
        }
        return { success: false, error: 'synthetic hover blocked' };
      },
    );
    chromeApi.scripting = { executeScript: vi.fn().mockRejectedValue(new Error('blocked')) };

    const result = await computerTool.execute({
      action: 'hover',
      tabId: 7,
      selector: '#menu',
      duration: 0,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text' });
    expect((result.content[0] as { text: string }).text).toContain('synthetic hover blocked');
  });
});
