import { CONTEXT_ACTION_MESSAGE_TYPES } from '@/common/message-types';
import { handlePageAction } from '@/utils/page-actions';

async function copyTextToClipboard(
  text: unknown,
): Promise<{ success: boolean; length?: number; error?: string }> {
  const value =
    typeof text === 'string' && text
      ? text
      : document.body?.innerText || document.documentElement?.innerText || '';
  if (!value) return { success: false, error: '网页没有可复制的文本内容。' };

  try {
    await navigator.clipboard.writeText(value);
    return { success: true, length: value.length };
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied
      ? { success: true, length: value.length }
      : { success: false, error: '浏览器拒绝访问剪贴板。' };
  }
}

function showToast(message: string, isError = false): void {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'left:50%',
    'top:24px',
    'transform:translateX(-50%)',
    'max-width:min(80vw,520px)',
    'padding:10px 16px',
    'border-radius:8px',
    'background:' + (isError ? '#b42318' : '#1f2937'),
    'color:#fff',
    'font:14px/1.4 sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,.25)',
  ].join(';');
  document.documentElement.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

const PAGE_ACTIONS = new Set<string>([
  CONTEXT_ACTION_MESSAGE_TYPES.SMART_CLOSE_POPUPS,
  CONTEXT_ACTION_MESSAGE_TYPES.RESTORE_PAGE_SCROLL,
  CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_ANIMATIONS,
  CONTEXT_ACTION_MESSAGE_TYPES.EXPAND_COLLAPSED_CONTENT,
  CONTEXT_ACTION_MESSAGE_TYPES.FOCUS_FIRST_INPUT,
  CONTEXT_ACTION_MESSAGE_TYPES.FILL_EMPTY_TEST_DATA,
  CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_ELEMENT_BORDERS,
  CONTEXT_ACTION_MESSAGE_TYPES.START_COLOR_PICKER,
  CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_IMAGES,
]);

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,

  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === CONTEXT_ACTION_MESSAGE_TYPES.COPY_TEXT_TO_CLIPBOARD) {
        void copyTextToClipboard(message.text).then((result) => {
          if (result.success) showToast(`网页文本已复制（${result.length || 0} 字）`);
          else if (result.error) showToast(result.error, true);
          sendResponse(result);
        });
        return true;
      }

      if (message?.action === CONTEXT_ACTION_MESSAGE_TYPES.SHOW_TOAST) {
        showToast(String(message.text || ''), !!message.isError);
        sendResponse({ success: true });
        return true;
      }

      if (PAGE_ACTIONS.has(message?.action)) {
        void handlePageAction(message.action).then(sendResponse);
        return true;
      }

      return false;
    });
  },
});
