import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { ERROR_MESSAGES } from '@/common/constants';
import { listMarkersForUrl } from '@/entrypoints/background/element-marker/element-marker-storage';

interface ReadPageStats {
  processed: number;
  included: number;
  durationMs: number;
}

interface ReadPageParams {
  url?: string;
  filter?: 'interactive'; // when omitted, return all visible elements
  depth?: number; // maximum DOM depth to traverse (0 = root only)
  refId?: string; // focus on subtree rooted at this refId
  tabId?: number; // target existing tab id
  windowId?: number; // when no tabId, pick active tab from this window
  maxOutputBytes?: number;
}

const DEFAULT_MAX_OUTPUT_BYTES = 24_000;
const MAX_MAX_OUTPUT_BYTES = 200_000;

class ReadPageTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.READ_PAGE;
  private readonly inFlightReads = new Map<string, Promise<ToolResult>>();

  // Merge only identical in-flight reads. A TTL cache would risk returning a
  // stale DOM immediately after a click or fill, so this optimization is safe
  // without needing invalidation hooks in every mutating tool.
  async execute(args: ReadPageParams): Promise<ToolResult> {
    const tabId = Number(args?.tabId);
    if (!Number.isInteger(tabId) || tabId < 0) return this.executeUncached(args);

    const key = JSON.stringify([
      tabId,
      args?.windowId,
      args?.url || '',
      args?.filter || 'all',
      args?.depth ?? null,
      args?.refId || '',
      args?.maxOutputBytes ?? null,
    ]);
    const existing = this.inFlightReads.get(key);
    if (existing) return existing;

    const pending = this.executeUncached(args).finally(() => {
      if (this.inFlightReads.get(key) === pending) this.inFlightReads.delete(key);
    });
    this.inFlightReads.set(key, pending);
    return pending;
  }

  private async executeUncached(args: ReadPageParams): Promise<ToolResult> {
    const { filter, depth, refId, url } = args || {};
    const requestedMaxOutputBytes = Number(args?.maxOutputBytes);
    const maxOutputBytes =
      Number.isFinite(requestedMaxOutputBytes) && requestedMaxOutputBytes > 0
        ? Math.min(Math.floor(requestedMaxOutputBytes), MAX_MAX_OUTPUT_BYTES)
        : DEFAULT_MAX_OUTPUT_BYTES;

    // Validate refId parameter
    const focusRefId = typeof refId === 'string' ? refId.trim() : '';
    if (refId !== undefined && !focusRefId) {
      return createErrorResponse(
        `${ERROR_MESSAGES.INVALID_PARAMETERS}: refId must be a non-empty string`,
      );
    }

    // Validate depth parameter
    const requestedDepth = depth === undefined ? undefined : Number(depth);
    if (requestedDepth !== undefined && (!Number.isInteger(requestedDepth) || requestedDepth < 0)) {
      return createErrorResponse(
        `${ERROR_MESSAGES.INVALID_PARAMETERS}: depth must be a non-negative integer`,
      );
    }

    // Track if user explicitly controlled the output (skip sparse heuristics)
    const userControlled = requestedDepth !== undefined || !!focusRefId;

    try {
      // Tip text returned to callers to guide next action
      const standardTips =
        "If the specific element you need is missing from the returned data, use the 'screenshot' tool to capture the current viewport and confirm the element's on-screen coordinates. Also note: 'markedElements' are user-marked elements and have the highest priority when choosing targets.";

      let tab = await this.resolveTargetTab(args?.tabId, args?.windowId);
      if (url) {
        if (typeof tab.id !== 'number') {
          return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND + ': Target tab has no ID');
        }
        await chrome.tabs.update(tab.id, { url });
        tab = await this.waitForTabReady(tab.id);
      }
      // An active tab can still be in the middle of a navigation even when no
      // URL was supplied. Do not capture the half-built DOM in that window.
      if (tab.status === 'loading' && typeof tab.id === 'number') {
        tab = await this.waitForTabReady(tab.id);
      }
      if (typeof tab.id !== 'number')
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND + ': Active tab has no ID');

      // Load any user-marked elements for this URL (priority hints)
      const currentUrl = String(tab.url || '');
      const userMarkers = currentUrl ? await listMarkersForUrl(currentUrl) : [];

      // Inject helper in ISOLATED world to enable chrome.runtime messaging
      // Inject into all frames to support same-origin iframe operations
      await this.injectContentScript(
        tab.id,
        ['inject-scripts/accessibility-tree-helper.js'],
        false,
        'ISOLATED',
        true,
      );

      const helperFiles = ['inject-scripts/accessibility-tree-helper.js'];
      // Ask every reachable frame for its own tree. `allFrames: true` only
      // injects the helper; tabs.sendMessage still addresses one frame, so a
      // top-frame-only request silently loses embedded forms and buttons.
      const discoveredFrames =
        !focusRefId && typeof chrome.webNavigation?.getAllFrames === 'function'
          ? await chrome.webNavigation.getAllFrames({ tabId: tab.id }).catch(() => [])
          : [];
      const frameIds = Array.from(
        new Set((discoveredFrames?.map((frame) => frame.frameId) || []).concat([0])),
      ).sort((a, b) => a - b);
      const frameResults = await Promise.all(
        frameIds.map(async (frameId) => {
          try {
            await this.sendMessageToTabWithRetry(
              tab.id!,
              { action: 'waitForPageSettled', timeoutMs: 700, quietMs: 90 },
              helperFiles,
              frameId,
            );
            const response = await this.sendMessageToTabWithRetry(
              tab.id!,
              {
                action: TOOL_MESSAGE_TYPES.GENERATE_ACCESSIBILITY_TREE,
                filter: filter || null,
                depth: requestedDepth,
                refId: focusRefId || undefined,
              },
              helperFiles,
              frameId,
            );
            return { frameId, response };
          } catch (error) {
            return { frameId, response: { success: false, error: String(error) } };
          }
        }),
      );

      const mainFrame = frameResults.find((item) => item.frameId === 0);
      const successfulFrames = frameResults.filter((item) => item.response?.success === true);
      const primary = mainFrame?.response || successfulFrames[0]?.response || {};
      const frameRefMaps = successfulFrames.flatMap(({ frameId, response }) =>
        (Array.isArray(response.refMap) ? response.refMap : []).map((item: any) => ({
          ...item,
          frameId,
        })),
      );
      const frameContent = successfulFrames
        .filter(({ response }) => typeof response.pageContent === 'string' && response.pageContent)
        .map(({ frameId, response }) =>
          frameId === 0 ? response.pageContent : `[frameId=${frameId}]\n${response.pageContent}`,
        );
      const resp = {
        ...primary,
        success: successfulFrames.length > 0,
        pageContent: frameContent.join('\n'),
        refMap: frameRefMaps,
        stats: successfulFrames.reduce(
          (total, { response }) => ({
            processed: total.processed + Number(response.stats?.processed || 0),
            included: total.included + Number(response.stats?.included || 0),
            durationMs: Math.max(total.durationMs, Number(response.stats?.durationMs || 0)),
          }),
          { processed: 0, included: 0, durationMs: 0 },
        ),
        dialogs: successfulFrames.flatMap(({ response }) =>
          Array.isArray(response.dialogs) ? response.dialogs : [],
        ),
        overlays: successfulFrames.flatMap(({ response }) =>
          Array.isArray(response.overlays) ? response.overlays : [],
        ),
      };

      // Evaluate tree result and decide whether to fallback
      const treeOk = resp && resp.success === true;
      const pageContent: string =
        resp && typeof resp.pageContent === 'string' ? resp.pageContent : '';

      // Extract stats from response
      const stats: ReadPageStats | null =
        treeOk && resp?.stats
          ? {
              processed: resp.stats.processed ?? 0,
              included: resp.stats.included ?? 0,
              durationMs: resp.stats.durationMs ?? 0,
            }
          : null;

      const lines = pageContent
        ? pageContent.split('\n').filter((l: string) => l.trim().length > 0).length
        : 0;
      const refCount = Array.isArray(resp?.refMap) ? resp.refMap.length : 0;

      // Skip sparse heuristics when user explicitly controls output
      const isSparse = !userControlled && lines < 10 && refCount < 3;

      // Build user-marked elements for inclusion
      const markedElements = userMarkers.map((m) => ({
        id: m.id,
        name: m.name,
        selector: m.selector,
        selectorType: m.selectorType || 'css',
        urlMatch: { type: m.matchType, origin: m.origin, path: m.path },
        source: 'marker',
        priority: 'highest',
      }));

      // Helper to convert elements array to pageContent format
      const formatElementsAsPageContent = (elements: any[]): string => {
        const out: string[] = [];
        for (const e of elements || []) {
          const type = typeof e?.type === 'string' && e.type ? e.type : 'element';
          const rawText = typeof e?.text === 'string' ? e.text.trim() : '';
          const text =
            rawText.length > 0
              ? ` "${rawText.replace(/\s+/g, ' ').slice(0, 100).replace(/"/g, '\\"')}"`
              : '';
          const selector =
            typeof e?.selector === 'string' && e.selector ? ` selector="${e.selector}"` : '';
          const coords =
            e?.coordinates && Number.isFinite(e.coordinates.x) && Number.isFinite(e.coordinates.y)
              ? ` (x=${Math.round(e.coordinates.x)},y=${Math.round(e.coordinates.y)})`
              : '';
          out.push(`- ${type}${text}${selector}${coords}`);
          if (out.length >= 150) break;
        }
        return out.join('\n');
      };

      // Unified base payload structure - consistent keys for stable contract
      const basePayload: Record<string, any> = {
        success: true,
        filter: filter || 'all',
        pageContent,
        tips: standardTips,
        viewport: treeOk ? resp.viewport : { width: null, height: null, dpr: null },
        stats: stats || { processed: 0, included: 0, durationMs: 0 },
        refMapCount: refCount,
        tabId: tab.id,
        windowId: tab.windowId,
        active: tab.active === true,
        url: tab.url || url || '',
        title: tab.title || '',
        sparse: treeOk ? isSparse : false,
        depth: requestedDepth ?? null,
        focus: focusRefId ? { refId: focusRefId, found: treeOk } : null,
        markedElements,
        elements: treeOk
          ? (Array.isArray(resp?.refMap) ? resp.refMap : []).map((item: any) => ({
              ...item,
              refId: item.ref,
            }))
          : [],
        count: treeOk ? refCount : 0,
        fallbackUsed: false,
        fallbackSource: null,
        reason: null,
        dialogs: Array.isArray(resp?.dialogs) ? resp.dialogs : [],
        overlays: Array.isArray(resp?.overlays) ? resp.overlays : [],
      };

      const serializePayload = (payload: Record<string, any>): string => {
        const originalPageContent = String(payload.pageContent || '');
        const originalPageContentBytes = new TextEncoder().encode(originalPageContent).length;
        let serialized = JSON.stringify(payload);
        if (new TextEncoder().encode(serialized).length <= maxOutputBytes) return serialized;

        let low = 0;
        let high = originalPageContent.length;
        let best = '';
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          payload.pageContent = originalPageContent.slice(0, mid);
          payload.outputTruncated = true;
          payload.originalPageContentBytes = originalPageContentBytes;
          serialized = JSON.stringify(payload);
          if (new TextEncoder().encode(serialized).length <= maxOutputBytes) {
            best = serialized;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        if (best) return best;

        payload.pageContent = '';
        payload.elements = Array.isArray(payload.elements) ? payload.elements.slice(0, 25) : [];
        payload.markedElements = Array.isArray(payload.markedElements)
          ? payload.markedElements.slice(0, 10)
          : [];
        payload.outputTruncated = true;
        payload.originalPageContentBytes = originalPageContentBytes;
        return JSON.stringify(payload);
      };

      // Normal path: return tree
      if (treeOk && !isSparse) {
        return {
          content: [{ type: 'text', text: serializePayload(basePayload) }],
          isError: false,
        };
      }

      // When refId is explicitly provided, do not fallback (refs are frame-local and may expire)
      if (focusRefId) {
        return createErrorResponse(resp?.error || `refId "${focusRefId}" not found or expired`);
      }

      // When user explicitly controls depth, do not override with fallback heuristics
      if (requestedDepth !== undefined) {
        return createErrorResponse(resp?.error || 'Failed to generate accessibility tree');
      }

      // Fallback path: try get_interactive_elements once
      try {
        await this.injectContentScript(tab.id, ['inject-scripts/interactive-elements-helper.js']);
        const fallback = await this.sendMessageToTabWithRetry(
          tab.id,
          {
            action: TOOL_MESSAGE_TYPES.GET_INTERACTIVE_ELEMENTS,
            includeCoordinates: true,
          },
          ['inject-scripts/interactive-elements-helper.js'],
        );

        if (fallback && fallback.success && Array.isArray(fallback.elements)) {
          const limited = fallback.elements.slice(0, 150);
          // Merge user markers at the front, de-duplicated by selector
          const markerEls = userMarkers.map((m) => ({
            id: m.id,
            type: 'marker',
            selector: m.selector,
            text: m.name,
            selectorType: m.selectorType || 'css',
            isInteractive: true,
            source: 'marker',
            priority: 'highest',
          }));
          const seen = new Set(markerEls.map((e) => e.selector));
          const merged = [...markerEls, ...limited.filter((e: any) => !seen.has(e.selector))];

          basePayload.fallbackUsed = true;
          basePayload.fallbackSource = 'get_interactive_elements';
          basePayload.reason = treeOk ? 'sparse_tree' : resp?.error || 'tree_failed';
          basePayload.elements = merged;
          basePayload.count = fallback.elements.length;
          if (!basePayload.pageContent) {
            basePayload.pageContent = formatElementsAsPageContent(merged);
          }

          return {
            content: [{ type: 'text', text: serializePayload(basePayload) }],
            isError: false,
          };
        }
      } catch (fallbackErr) {
        console.warn('read_page fallback failed:', fallbackErr);
      }

      // If we reach here, both tree (usable) and fallback failed
      return createErrorResponse(
        treeOk
          ? 'Accessibility tree is too sparse and fallback failed'
          : resp?.error || 'Failed to generate accessibility tree and fallback failed',
      );
    } catch (error) {
      console.error('Error in read page tool:', error);
      return createErrorResponse(
        `Error generating accessibility tree: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const readPageTool = new ReadPageTool();
