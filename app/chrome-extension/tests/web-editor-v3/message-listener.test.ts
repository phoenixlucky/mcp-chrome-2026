import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEB_EDITOR_V3_ACTIONS, type WebEditorV3Api } from '@/common/web-editor-types';
import { installMessageListener } from '@/entrypoints/web-editor-v3/core/message-listener';

type MessageListener = (
  request: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean;

function createApi() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    toggle: vi.fn().mockReturnValue(true),
    getState: vi.fn().mockReturnValue({ active: false, version: 3 }),
    revertElement: vi.fn().mockResolvedValue({ success: true }),
    clearSelection: vi.fn(),
    setScrollCoordinatesVisible: vi.fn(),
  } satisfies WebEditorV3Api;
}

function install(api: WebEditorV3Api): { listener: MessageListener; remove: () => void } {
  const remove = installMessageListener(api);
  const addListener = vi.mocked(chrome.runtime.onMessage.addListener);
  const listener = addListener.mock.calls.at(-1)?.[0] as MessageListener | undefined;
  if (!listener) throw new Error('message listener was not installed');
  return { listener, remove };
}

describe('web-editor-v3 message listener smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('responds to lifecycle and HUD commands', () => {
    const api = createApi();
    const { listener, remove } = install(api);
    const responses: unknown[] = [];

    expect(listener({ action: WEB_EDITOR_V3_ACTIONS.PING }, {} as chrome.runtime.MessageSender, (r) => responses.push(r))).toBe(false);
    expect(responses.at(-1)).toEqual({ status: 'pong', active: false, version: 3 });

    listener({ action: WEB_EDITOR_V3_ACTIONS.TOGGLE }, {} as chrome.runtime.MessageSender, (r) => responses.push(r));
    listener({ action: WEB_EDITOR_V3_ACTIONS.START }, {} as chrome.runtime.MessageSender, (r) => responses.push(r));
    listener({ action: WEB_EDITOR_V3_ACTIONS.STOP }, {} as chrome.runtime.MessageSender, (r) => responses.push(r));
    listener(
      { action: WEB_EDITOR_V3_ACTIONS.SET_SCROLL_COORDINATES, enabled: true },
      {} as chrome.runtime.MessageSender,
      (r) => responses.push(r),
    );

    expect(api.toggle).toHaveBeenCalledOnce();
    expect(api.start).toHaveBeenCalledOnce();
    expect(api.stop).toHaveBeenCalledOnce();
    expect(api.setScrollCoordinatesVisible).toHaveBeenCalledWith(true);
    expect(responses.slice(-4)).toEqual([
      { active: true },
      { active: true },
      { active: false },
      { success: true },
    ]);

    remove();
    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledOnce();
  });

  it('highlights and clears a selector target', () => {
    const target = document.createElement('button');
    target.id = 'target';
    target.getBoundingClientRect = () =>
      ({ top: 10, left: 20, width: 100, height: 40 } as DOMRect);
    document.body.appendChild(target);

    const { listener, remove } = install(createApi());
    const responses: unknown[] = [];

    listener(
      { action: WEB_EDITOR_V3_ACTIONS.HIGHLIGHT_ELEMENT, mode: 'hover', selector: '#target' },
      {} as chrome.runtime.MessageSender,
      (r) => responses.push(r),
    );
    expect(responses.at(-1)).toEqual({ success: true });
    expect(document.querySelector('[data-web-editor-highlight="true"]')).not.toBeNull();

    listener(
      { action: WEB_EDITOR_V3_ACTIONS.HIGHLIGHT_ELEMENT, mode: 'clear' },
      {} as chrome.runtime.MessageSender,
      (r) => responses.push(r),
    );
    expect(responses.at(-1)).toEqual({ success: true });
    expect(document.querySelector('[data-web-editor-highlight="true"]')).toBeNull();
    remove();
  });
});
