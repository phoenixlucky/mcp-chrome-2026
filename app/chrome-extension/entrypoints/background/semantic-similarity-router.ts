import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

const SEMANTIC_MESSAGE_TYPES = new Set<string>([
  BACKGROUND_MESSAGE_TYPES.SWITCH_SEMANTIC_MODEL,
  BACKGROUND_MESSAGE_TYPES.GET_MODEL_STATUS,
  BACKGROUND_MESSAGE_TYPES.UPDATE_MODEL_STATUS,
  BACKGROUND_MESSAGE_TYPES.INITIALIZE_SEMANTIC_ENGINE,
]);

/** Keep the service-worker entry light until a caller uses semantic search. */
export function initSemanticSimilarityListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!SEMANTIC_MESSAGE_TYPES.has(message.type)) return false;

    void import('./semantic-similarity')
      .then(({ handleSemanticBackgroundMessage }) => handleSemanticBackgroundMessage(message))
      .then(sendResponse)
      .catch((error: unknown) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );

    return true;
  });
}
