import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

vi.mock('@/entrypoints/background/tools/browser/computer', () => ({ computerTool: {} }));
vi.mock('@/entrypoints/background/tools/browser/interaction', () => ({ clickTool: {} }));
vi.mock('@/entrypoints/background/tools/browser/keyboard', () => ({ keyboardTool: {} }));
vi.mock('@/entrypoints/background/element-marker/element-marker-storage', () => ({
  deleteMarker: vi.fn(),
  listAllMarkers: vi.fn(),
  listMarkersForUrl: vi.fn(),
  saveMarker: vi.fn(),
  updateMarker: vi.fn(),
}));

import { initElementMarkerListeners } from '@/entrypoints/background/element-marker';

describe('element marker batch validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chrome as any).scripting = { executeScript: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: false, error: 'probe' });
  });

  it('passes XPath type to the helper when resolving a multi-select union', async () => {
    initElementMarkerListeners();
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls.at(-1)?.[0];
    if (!listener) throw new Error('Marker listener not registered');

    await new Promise<void>((resolve) => {
      listener(
        {
          type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE,
          selector: '//*[@id="one"] | //*[@id="two"]',
          selectorType: 'xpath',
          listMode: true,
          action: 'hover',
        },
        { tab: { id: 1 } } as chrome.runtime.MessageSender,
        () => resolve(),
      );
    });

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ action: 'locateElements', selectorType: 'xpath' }),
      { frameId: 0 },
    );
  });
});
