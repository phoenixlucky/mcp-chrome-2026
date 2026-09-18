import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type {
  UpsertMarkerRequest,
  ElementMarker,
  MarkerValidationRequest,
  MarkerValidationAction,
} from '@/common/element-marker-types';
import {
  deleteMarker,
  listAllMarkers,
  listMarkersForUrl,
  saveMarker,
  updateMarker,
} from './element-marker-storage';
import { computerTool } from '@/entrypoints/background/tools/browser/computer';
import { clickTool } from '@/entrypoints/background/tools/browser/interaction';
import { keyboardTool } from '@/entrypoints/background/tools/browser/keyboard';

const CONTEXT_MENU_ID = 'element_marker_mark';

/**
 * Extract error message from MCP tool result
 */
function extractToolError(result: any): string | undefined {
  if (!result) return undefined;

  // Check for error in result content array
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item?.text) {
        try {
          const parsed = JSON.parse(item.text);
          if (parsed?.error) return parsed.error;
          if (parsed?.message) return parsed.message;
        } catch {
          // Not JSON, use as-is
          return item.text;
        }
      }
    }
  }

  // Fallback to direct error field
  return result.error || (result.isError ? 'unknown tool error' : undefined);
}

async function executeMarkerValidationAction({
  action,
  req,
  tabId,
  locatorTarget,
  coordinates,
}: {
  action: MarkerValidationAction;
  req: any;
  tabId: number;
  locatorTarget: Record<string, unknown>;
  coordinates?: { x: number; y: number };
}): Promise<{ name: string; ok: boolean; error?: string }> {
  switch (action) {
    case 'hover': {
      const result = await computerTool.execute({
        action: 'hover',
        ...locatorTarget,
        tabId,
      } as any);
      return {
        name: 'computer.hover',
        ok: !result.isError,
        error: result.isError ? extractToolError(result) : undefined,
      };
    }
    case 'left_click':
    case 'double_click':
    case 'right_click': {
      const result = await clickTool.execute({
        ...locatorTarget,
        tabId,
        double: action === 'double_click',
        waitForNavigation: !!req.waitForNavigation,
        timeout: Number.isFinite(req.timeoutMs) ? req.timeoutMs : 3000,
        button: action === 'right_click' ? 'right' : req.button || 'left',
        modifiers: req.modifiers || {},
      } as any);
      return {
        name:
          action === 'double_click'
            ? 'interaction.click(double)'
            : action === 'right_click'
              ? 'interaction.click(right)'
              : 'interaction.click',
        ok: !result.isError,
        error: result.isError ? extractToolError(result) : undefined,
      };
    }
    case 'scroll': {
      const result = await computerTool.execute({
        action: 'scroll',
        scrollDirection: req.scrollDirection || 'down',
        scrollAmount: Number.isFinite(req.scrollAmount) ? Number(req.scrollAmount) : 300,
        coordinates,
        tabId,
      } as any);
      return {
        name: 'computer.scroll',
        ok: !result.isError,
        error: result.isError ? extractToolError(result) : undefined,
      };
    }
    case 'type_text': {
      const focus = await clickTool.execute({
        ...locatorTarget,
        tabId,
        waitForNavigation: false,
        timeout: 2000,
      } as any);
      if (focus.isError) {
        return {
          name: 'interaction.click',
          ok: false,
          error: extractToolError(focus),
        };
      }
      const result = await computerTool.execute({
        action: 'type',
        text: String(req.text || ''),
        tabId,
      } as any);
      return {
        name: 'computer.type',
        ok: !result.isError,
        error: result.isError ? extractToolError(result) : undefined,
      };
    }
    case 'press_keys': {
      const focus = await clickTool.execute({
        ...locatorTarget,
        tabId,
        waitForNavigation: false,
        timeout: 2000,
      } as any);
      if (focus.isError) {
        return {
          name: 'interaction.click',
          ok: false,
          error: extractToolError(focus),
        };
      }
      const result = await keyboardTool.execute({
        keys: String(req.keys || ''),
        delay: 0,
        tabId,
      } as any);
      return {
        name: 'keyboard.simulate',
        ok: !result.isError,
        error: result.isError ? extractToolError(result) : undefined,
      };
    }
    default:
      return { name: 'noop', ok: true };
  }
}

async function ensureContextMenu() {
  try {
    // Guard: contextMenus permission may be missing
    if (!(chrome as any).contextMenus?.create) return;
    // Remove and re-create our single menu to avoid duplication
    try {
      await chrome.contextMenus.remove(CONTEXT_MENU_ID);
    } catch {}
    await chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: '标注元素',
      contexts: ['all'],
    });
  } catch (e) {
    console.warn('ElementMarker: ensureContextMenu failed:', e);
  }
}

/**
 * Check if element-marker.js is already injected in the tab
 * Uses a short timeout to avoid hanging on unresponsive tabs
 */
async function isMarkerInjected(tabId: number): Promise<boolean> {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: 'element_marker_ping' }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
    ]);
    return response?.status === 'pong';
  } catch {
    return false;
  }
}

/**
 * Inject element-marker.js into the tab if not already injected
 */
async function injectMarkerHelper(tabId: number) {
  // Check if already injected via ping
  const alreadyInjected = await isMarkerInjected(tabId);

  if (!alreadyInjected) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['inject-scripts/element-marker.js'],
        world: 'ISOLATED',
      } as any);
    } catch (e) {
      // Script injection may fail on some pages (e.g., chrome:// URLs)
      console.warn('ElementMarker: script injection failed:', e);
    }
  }

  try {
    await chrome.tabs.sendMessage(tabId, { action: 'element_marker_start' } as any);
  } catch (e) {
    console.warn('ElementMarker: start overlay failed:', e);
  }
}

export function initElementMarkerListeners() {
  // Ensure context menu on startup
  ensureContextMenu().catch(() => {});

  // Respond to RR triggers refresh by re-ensuring our menu a bit later
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message?.type) {
        // Handle element marker start from popup
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_START: {
          const tabId = message.tabId;
          if (typeof tabId !== 'number') {
            sendResponse({ success: false, error: 'invalid tabId' });
            return true;
          }
          injectMarkerHelper(tabId)
            .then(() => sendResponse({ success: true }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_ALL: {
          listAllMarkers()
            .then((markers) => sendResponse({ success: true, markers }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_FOR_URL: {
          const url = String(message.url || '');
          listMarkersForUrl(url)
            .then((markers) => sendResponse({ success: true, markers }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_SAVE: {
          const req = message.marker as UpsertMarkerRequest;
          saveMarker(req)
            .then((marker) => sendResponse({ success: true, marker }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_UPDATE: {
          const marker = message.marker as ElementMarker;
          updateMarker(marker)
            .then(() => sendResponse({ success: true }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_DELETE: {
          const id = String(message.id || '');
          if (!id) {
            sendResponse({ success: false, error: 'invalid id' });
            return true;
          }
          deleteMarker(id)
            .then(() => sendResponse({ success: true }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE: {
          // Validate via MCP tool chain
          (async () => {
            const req = message as {
              selector: string;
              selectorType?: 'css' | 'xpath';
              action: MarkerValidationAction;
              listMode?: boolean;
              text?: string;
              keys?: string;
              button?: 'left' | 'right' | 'middle';
              bubbles?: boolean;
              cancelable?: boolean;
              modifiers?: any;
              coordinates?: { x: number; y: number };
              offsetX?: number;
              offsetY?: number;
              relativeTo?: 'element' | 'viewport';
              waitForNavigation?: boolean;
              timeoutMs?: number;
              scrollDirection?: 'up' | 'down' | 'left' | 'right';
              scrollAmount?: number;
            };
            // enrich typing with optional nav + scroll params
            (req as any).waitForNavigation = (message as any).waitForNavigation;
            (req as any).timeoutMs = (message as any).timeoutMs;
            (req as any).scrollDirection = (message as any).scrollDirection;
            (req as any).scrollAmount = (message as any).scrollAmount;
            const selector = String(req.selector || '').trim();
            const selectorType = (req.selectorType || 'css') as 'css' | 'xpath';
            const action = req.action as MarkerValidationAction;
            if (!selector) return sendResponse({ success: false, error: 'selector is required' });
            let tabId = sender.tab?.id ?? message.tabId;
            if (typeof tabId !== 'number') {
              const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
              tabId = activeTab?.id;
            }
            if (typeof tabId !== 'number') {
              return sendResponse({ success: false, error: 'active tab not found' });
            }

            // 1) Ensure helper
            try {
              await chrome.scripting.executeScript({
                target: { tabId, allFrames: true },
                files: ['inject-scripts/accessibility-tree-helper.js'],
                world: 'ISOLATED',
              } as any);
            } catch {}

            // 2) Resolve selector -> one or many refs via helper.
            let ensured: any;
            try {
              const isCompositeSelector = selectorType === 'css' && selector.includes('|>');
              const resolveMany = !!req.listMode && !isCompositeSelector;
              ensured = await chrome.tabs.sendMessage(
                tabId,
                {
                  action: resolveMany
                    ? 'locateElements'
                    : isCompositeSelector
                      ? 'ensureRefForSelector'
                      : 'locateElement',
                  selector,
                  ...(isCompositeSelector ? { isXPath: false } : {}),
                  allowMultiple: !!req.listMode,
                  scrollIntoView: true,
                  highlight: false,
                } as any,
                { frameId: 0 },
              );
            } catch (e) {
              return sendResponse({
                success: false,
                error: String(e instanceof Error ? e.message : e),
              });
            }
            if (!ensured || !ensured.success) {
              return sendResponse({
                success: false,
                error: ensured?.error || 'failed to resolve selector',
              });
            }

            const listElements =
              req.listMode && Array.isArray(ensured.elements) ? ensured.elements : [];
            if (req.listMode && listElements.length === 0) {
              return sendResponse({ success: false, error: '未找到可验证的批量元素' });
            }

            const base = {
              success: true,
              resolved: true,
              ref: ensured.ref,
              center: ensured.center,
              ...(req.listMode
                ? {
                    matchCount: listElements.length,
                    elements: listElements.map((item: any) => ({
                      ref: item.ref,
                      selector: item.selector,
                      center: item.center,
                    })),
                  }
                : {}),
            } as any;

            // Compute optional coordinates from offsets
            let coords: { x: number; y: number } | undefined =
              ensured.center || listElements[0]?.center;
            if (
              req.coordinates &&
              typeof req.coordinates.x === 'number' &&
              typeof req.coordinates.y === 'number'
            ) {
              coords = { x: Math.round(req.coordinates.x), y: Math.round(req.coordinates.y) };
            } else if (
              req.relativeTo === 'element' &&
              ensured.center &&
              (typeof req.offsetX === 'number' || typeof req.offsetY === 'number')
            ) {
              const dx = Number.isFinite(req.offsetX as any) ? (req.offsetX as number) : 0;
              const dy = Number.isFinite(req.offsetY as any) ? (req.offsetY as number) : 0;
              coords = { x: ensured.center.x + dx, y: ensured.center.y + dy };
            }
            if (!coords && !req.listMode) {
              return sendResponse({
                success: false,
                error: '定位成功但无法获取元素坐标，请重新选择后验证',
              });
            }

            // A center point becomes stale when the page scrolls, reflows, or
            // the marker panel changes the viewport. Let the DOM tools resolve
            // normal selectors themselves so they can scroll and re-check the
            // current element immediately before dispatching the action.
            const isCompositeSelector = selectorType === 'css' && selector.includes('|>');
            const locatorTarget = isCompositeSelector
              ? { coordinates: coords }
              : { selector, selectorType };

            // 3) Dispatch to the tool once per matched element. A list marker
            // must never collapse back to the first ref during validation.
            const items = req.listMode
              ? listElements
              : [{ ref: ensured.ref, selector, center: ensured.center }];
            const validationResults: any[] = [];

            for (let index = 0; index < items.length; index += 1) {
              const item = items[index] || {};
              const itemCenter = item.center || coords;
              let itemCoords = itemCenter;
              if (
                req.coordinates &&
                typeof req.coordinates.x === 'number' &&
                typeof req.coordinates.y === 'number'
              ) {
                itemCoords = {
                  x: Math.round(req.coordinates.x),
                  y: Math.round(req.coordinates.y),
                };
              } else if (
                req.relativeTo === 'element' &&
                itemCenter &&
                (typeof req.offsetX === 'number' || typeof req.offsetY === 'number')
              ) {
                itemCoords = {
                  x: itemCenter.x + (Number.isFinite(req.offsetX) ? req.offsetX : 0),
                  y: itemCenter.y + (Number.isFinite(req.offsetY) ? req.offsetY : 0),
                };
              }

              const itemTarget = isCompositeSelector
                ? { coordinates: itemCoords }
                : {
                    ref: item.ref,
                    selector: item.selector || selector,
                    selectorType,
                  };
              let tool;
              try {
                tool = await executeMarkerValidationAction({
                  action,
                  req,
                  tabId,
                  locatorTarget: itemTarget,
                  coordinates: itemCoords,
                });
              } catch (e) {
                tool = {
                  name: 'unknown',
                  ok: false,
                  error: String(e instanceof Error ? e.message : e),
                };
              }
              validationResults.push({
                index: index + 1,
                ref: item.ref,
                center: itemCenter,
                tool,
              });
            }

            if (req.listMode) {
              base.results = validationResults;
              base.tool = {
                name: 'batch.validation',
                ok: validationResults.every((result) => result.tool.ok),
                successCount: validationResults.filter((result) => result.tool.ok).length,
                failureCount: validationResults.filter((result) => !result.tool.ok).length,
              };
            } else {
              base.tool = validationResults[0]?.tool || {
                name: 'unknown',
                ok: false,
                error: 'validation did not run',
              };
            }

            // Log tool failures for debugging
            if (base.tool && base.tool.ok === false) {
              console.warn('[ElementMarker] Tool validation failure', {
                action,
                toolName: base.tool.name,
                error: base.tool.error,
                selector,
                selectorType,
              });
            }

            return sendResponse(base);
          })();
          return true;
        }
        // When RR refresh (or similar) happens, re-add our menu
        case BACKGROUND_MESSAGE_TYPES.RR_REFRESH_TRIGGERS:
        case BACKGROUND_MESSAGE_TYPES.RR_SAVE_TRIGGER:
        case BACKGROUND_MESSAGE_TYPES.RR_DELETE_TRIGGER: {
          setTimeout(() => ensureContextMenu().catch(() => {}), 300);
          break;
        }
      }
    } catch (e) {
      sendResponse({ success: false, error: (e as any)?.message || String(e) });
    }
    return false;
  });

  // Context menu click routing
  if ((chrome as any).contextMenus?.onClicked?.addListener) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      try {
        if (info.menuItemId === CONTEXT_MENU_ID && tab?.id) {
          await injectMarkerHelper(tab.id);
        }
      } catch (e) {
        console.warn('ElementMarker: context menu click failed:', e);
      }
    });
  }
}
