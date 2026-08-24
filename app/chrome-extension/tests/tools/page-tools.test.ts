import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTabTool,
  elementInfoTool,
  hoverTool,
  printToPdfTool,
  storageGetTool,
  storageSetTool,
} from '@/entrypoints/background/tools/browser/page-tools';

const chromeApi = globalThis.chrome as any;

function resultValue(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('page tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeApi.tabs.get.mockResolvedValue({ id: 7, windowId: 3, url: 'https://example.com' });
    chromeApi.debugger.getTargets.mockResolvedValue([]);
    chromeApi.debugger.attach.mockResolvedValue(undefined);
    chromeApi.debugger.detach.mockResolvedValue(undefined);
  });

  it('creates a pinned background tab in a selected window', async () => {
    chromeApi.tabs.create.mockResolvedValue({
      id: 8,
      windowId: 3,
      url: 'https://example.com/new',
      active: false,
      pinned: true,
    });

    const result = await createTabTool.execute({
      url: 'https://example.com/new',
      windowId: 3,
      background: true,
      pinned: true,
    });

    expect(chromeApi.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/new',
      windowId: 3,
      active: false,
      pinned: true,
    });
    expect(resultValue(result)).toMatchObject({ tabId: 8, active: false, pinned: true });
  });

  it('hovers a CSS-selected element through CDP mouse movement', async () => {
    chromeApi.debugger.sendCommand
      .mockResolvedValueOnce({
        result: { value: { found: true, x: 20, y: 30, tagName: 'BUTTON' } },
      })
      .mockResolvedValueOnce({});

    const result = await hoverTool.execute({ tabId: 7, selector: '#menu', durationMs: 0 });

    expect(chromeApi.debugger.sendCommand).toHaveBeenLastCalledWith(
      { tabId: 7 },
      'Input.dispatchMouseEvent',
      { type: 'mouseMoved', x: 20, y: 30, button: 'none' },
    );
    expect(resultValue(result)).toMatchObject({ success: true, selector: '#menu' });
  });

  it('returns element info and prints a PDF through CDP', async () => {
    chromeApi.debugger.sendCommand
      .mockResolvedValueOnce({
        result: {
          value: {
            found: true,
            tagName: 'button',
            attributes: { id: 'save' },
            computedStyles: { display: 'block' },
            boundingRect: { x: 1, y: 2, width: 3, height: 4 },
          },
        },
      })
      .mockResolvedValueOnce({ data: 'pdf-base64' });

    const info = await elementInfoTool.execute({ tabId: 7, selector: '#save' });
    const pdf = await printToPdfTool.execute({ tabId: 7, pageSize: 'A4' });

    expect(resultValue(info)).toMatchObject({
      success: true,
      attributes: { id: 'save' },
      boundingRect: { width: 3, height: 4 },
    });
    expect(resultValue(pdf)).toMatchObject({
      success: true,
      mimeType: 'application/pdf',
      base64Data: 'pdf-base64',
    });
    expect(chromeApi.debugger.sendCommand).toHaveBeenLastCalledWith(
      { tabId: 7 },
      'Page.printToPDF',
      expect.objectContaining({ paperWidth: 8.2677, paperHeight: 11.6929 }),
    );
  });

  it('reads and writes page storage using the requested area', async () => {
    chromeApi.debugger.sendCommand
      .mockResolvedValueOnce({
        result: { value: { storageArea: 'sessionStorage', items: { token: 'abc' } } },
      })
      .mockResolvedValueOnce({
        result: { value: { storageArea: 'sessionStorage', items: { token: 'abc' } } },
      });

    const get = await storageGetTool.execute({ tabId: 7, storageArea: 'session', key: 'token' });
    const set = await storageSetTool.execute({
      tabId: 7,
      storageArea: 'session',
      key: 'token',
      value: 'abc',
    });

    expect(resultValue(get)).toMatchObject({
      storageArea: 'sessionStorage',
      items: { token: 'abc' },
    });
    expect(resultValue(set)).toMatchObject({
      storageArea: 'sessionStorage',
      items: { token: 'abc' },
    });
  });
});
