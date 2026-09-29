import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { handleSemanticBackgroundMessage } from '@/entrypoints/background/semantic-similarity';
import { initSemanticSimilarityListener } from '@/entrypoints/background/semantic-similarity-router';

vi.mock('@/entrypoints/background/semantic-similarity', () => ({
  handleSemanticBackgroundMessage: vi.fn(async () => ({ success: true, status: 'ready' })),
}));

describe('semantic similarity message router', () => {
  let listeners: Array<(message: any, sender: any, sendResponse: (value: any) => void) => unknown>;

  beforeEach(() => {
    listeners = [];
    vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener: any) => {
      listeners.push(listener);
      return undefined as never;
    });
    vi.mocked(handleSemanticBackgroundMessage).mockClear();
  });

  it('does not load the semantic module for unrelated messages', () => {
    initSemanticSimilarityListener();
    const sendResponse = vi.fn();

    expect(listeners[0]({ type: 'unrelated' }, {}, sendResponse)).toBe(false);
    expect(handleSemanticBackgroundMessage).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('loads the semantic handler only for semantic messages and keeps async response open', async () => {
    initSemanticSimilarityListener();
    const sendResponse = vi.fn();

    expect(
      listeners[0]({ type: BACKGROUND_MESSAGE_TYPES.GET_MODEL_STATUS }, {}, sendResponse),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ success: true, status: 'ready' }),
    );
    expect(handleSemanticBackgroundMessage).toHaveBeenCalledOnce();
  });
});
