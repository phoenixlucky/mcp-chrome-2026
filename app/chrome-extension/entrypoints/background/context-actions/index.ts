import { CONTEXT_ACTION_MESSAGE_TYPES } from '@/common/message-types';
import { screenshotTool } from '../tools/browser/screenshot';

const COPY_PAGE_TEXT_MENU_ID = CONTEXT_ACTION_MESSAGE_TYPES.COPY_TEXT_TO_CLIPBOARD;
const LEGACY_BATCH_CLICK_MENU_ID = 'context_action_batch_click_similar_buttons';
const PAGE_ACTIONS_MENU_ID = 'context_action_page_utilities';

const PAGE_ACTION_MENUS = [
  { id: CONTEXT_ACTION_MESSAGE_TYPES.COPY_TEXT_TO_CLIPBOARD, title: 'Copy page text' },
  {
    id: CONTEXT_ACTION_MESSAGE_TYPES.SMART_CLOSE_POPUPS,
    title: 'Smart-dismiss cookie / ad popups',
  },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.RESTORE_PAGE_SCROLL, title: 'Restore page scroll' },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_ANIMATIONS, title: 'Disable page animations' },
  {
    id: CONTEXT_ACTION_MESSAGE_TYPES.EXPAND_COLLAPSED_CONTENT,
    title: 'Expand all collapsed content',
  },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.FOCUS_FIRST_INPUT, title: 'Focus first input' },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.FILL_EMPTY_TEST_DATA, title: 'Fill empty test data' },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_ELEMENT_BORDERS, title: 'Show element borders' },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.START_COLOR_PICKER, title: 'Pick a page color' },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_IMAGES, title: 'Hide page images' },
  { id: CONTEXT_ACTION_MESSAGE_TYPES.CAPTURE_FULL_PAGE, title: 'Capture full page screenshot' },
] as const;

async function ensureContextMenus(): Promise<void> {
  if (!(chrome as any).contextMenus?.create) return;

  for (const id of [COPY_PAGE_TEXT_MENU_ID, LEGACY_BATCH_CLICK_MENU_ID, PAGE_ACTIONS_MENU_ID]) {
    try {
      await chrome.contextMenus.remove(id);
    } catch {}
  }

  await chrome.contextMenus.create({
    id: PAGE_ACTIONS_MENU_ID,
    title: 'Page quick actions',
    contexts: ['all'],
  });
  for (const item of PAGE_ACTION_MENUS) {
    await chrome.contextMenus.create({
      id: item.id,
      parentId: PAGE_ACTIONS_MENU_ID,
      title: item.title,
      contexts: ['all'],
    });
  }
}

async function handleCopyPageText(tabId: number): Promise<void> {
  let response: any;
  try {
    response = await sendToFrame(tabId, 0, {
      action: CONTEXT_ACTION_MESSAGE_TYPES.COPY_TEXT_TO_CLIPBOARD,
    });
  } catch {}

  if (!response?.success) {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: async () => {
        const text = document.body?.innerText || document.documentElement?.innerText || '';
        if (!text) return { success: false, error: 'The page has no text content to copy.' };
        try {
          await navigator.clipboard.writeText(text);
          return { success: true, length: text.length };
        } catch {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', '');
          textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand('copy');
          textarea.remove();
          return success
            ? { success: true, length: text.length }
            : { success: false, error: 'The browser denied clipboard access.' };
        }
      },
    });
    response = result?.result;
  }
  if (!response?.success) throw new Error(response?.error || 'Failed to copy page text.');
}

async function sendToFrame(tabId: number, frameId: number, message: unknown): Promise<any> {
  try {
    return await chrome.tabs.sendMessage(tabId, message, { frameId });
  } catch (error) {
    // Existing tabs can predate the extension reload and have no context-actions listener yet.
    // Inject the already-built content script once, then retry the same request.
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ['content-scripts/context-actions.js'],
    });
    try {
      return await chrome.tabs.sendMessage(tabId, message, { frameId });
    } catch {
      throw error;
    }
  }
}

function extractToolPayload(result: any): any {
  const text = result?.content?.find?.((item: any) => item?.type === 'text')?.text;
  if (typeof text !== 'string') return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function handleFullScreenshot(tabId: number): Promise<void> {
  const result = await screenshotTool.execute({
    name: 'full_page_screenshot',
    tabId,
    fullPage: true,
    savePng: true,
  });
  if (result?.isError) {
    const errorText = (result.content as any[])?.find((item) => item?.type === 'text')?.text;
    throw new Error(errorText || 'Full page screenshot failed');
  }
  const payload = extractToolPayload(result);
  const filename = payload.filename || payload.fullPath || 'screenshot file';
  try {
    await sendToFrame(tabId, 0, {
      action: CONTEXT_ACTION_MESSAGE_TYPES.SHOW_TOAST,
      text: `Full page screenshot downloaded: ${filename}`,
    });
  } catch {}
}

export function initContextActionListeners(): void {
  ensureContextMenus().catch((error) => {
    console.warn('[ContextActions] Failed to ensure context menus:', error);
  });

  if (!(chrome as any).contextMenus?.onClicked?.addListener) return;

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const tabId = tab?.id;
    if (typeof tabId !== 'number') return;

    try {
      const pageAction = PAGE_ACTION_MENUS.find((item) => item.id === info.menuItemId);
      if (pageAction) {
        if (pageAction.id === CONTEXT_ACTION_MESSAGE_TYPES.COPY_TEXT_TO_CLIPBOARD) {
          await handleCopyPageText(tabId);
          return;
        }
        if (pageAction.id === CONTEXT_ACTION_MESSAGE_TYPES.CAPTURE_FULL_PAGE) {
          await handleFullScreenshot(tabId);
          return;
        }
        const frameId = typeof info.frameId === 'number' ? info.frameId : 0;
        const response = await sendToFrame(tabId, frameId, { action: pageAction.id });
        if (!response?.success) {
          throw new Error(response?.error || `${pageAction.title} failed`);
        }
        if (pageAction.id === CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_ANIMATIONS) {
          await chrome.contextMenus.update(pageAction.id, {
            title: response.enabled ? 'Restore page animations' : 'Disable page animations',
          });
        }
        if (pageAction.id === CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_ELEMENT_BORDERS) {
          await chrome.contextMenus.update(pageAction.id, {
            title: response.enabled ? 'Hide element borders' : 'Show element borders',
          });
        }
        if (pageAction.id === CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_IMAGES) {
          await chrome.contextMenus.update(pageAction.id, {
            title: response.enabled ? 'Show page images' : 'Hide page images',
          });
        }
        return;
      }
    } catch (error) {
      console.warn('[ContextActions] Context action failed:', error);
      try {
        await sendToFrame(tabId, 0, {
          action: CONTEXT_ACTION_MESSAGE_TYPES.SHOW_TOAST,
          text: error instanceof Error ? error.message : 'Page quick action failed.',
          isError: true,
        });
      } catch {
        // The target page may be restricted or already navigating.
      }
    }
  });
}
