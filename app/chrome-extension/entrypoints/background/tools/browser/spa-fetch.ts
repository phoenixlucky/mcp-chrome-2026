/**
 * SPA Fetch Tool - chrome_spa_fetch
 *
 * Navigate to a SPA URL, wait for JS rendering, auto-scroll to trigger
 * lazy-loaded content, then extract the full rendered text content.
 *
 * Designed for sites like X/Twitter, Reddit, and other JS-heavy pages
 * where plain HTTP fetch returns no meaningful text.
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_SCROLLS = 5;
const DEFAULT_SCROLL_DELAY_MS = 2_000;
const DEFAULT_WAIT_TIMEOUT_MS = 20_000;
const CDP_SESSION_KEY = 'spa-fetch';
const SCROLL_STEP_PX = 800;
const POST_NAVIGATION_STABILIZE_MS = 2_000;
const POST_SCROLL_STABILIZE_MS = 1_000;
const POLL_INTERVAL_MS = 500;
const TEMP_TAB_IDLE_TIMEOUT_MINUTES = 2;
const TEMP_TAB_ALARM_PREFIX = 'chrome-spa-fetch-idle:';

const getTempTabAlarmName = (tabId: number) => `${TEMP_TAB_ALARM_PREFIX}${tabId}`;

export async function pauseSpaFetchTabCleanup(tabId: number): Promise<boolean> {
  const alarmName = getTempTabAlarmName(tabId);
  const alarm = await chrome.alarms.get(alarmName);
  if (!alarm) return false;
  await chrome.alarms.clear(alarmName);
  return true;
}

export async function scheduleSpaFetchTabCleanup(tabId: number): Promise<void> {
  try {
    await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  await chrome.alarms.create(getTempTabAlarmName(tabId), {
    delayInMinutes: TEMP_TAB_IDLE_TIMEOUT_MINUTES,
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(TEMP_TAB_ALARM_PREFIX)) return;
  const tabId = Number(alarm.name.slice(TEMP_TAB_ALARM_PREFIX.length));
  if (!Number.isInteger(tabId)) return;
  void chrome.tabs.remove(tabId).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.alarms.clear(getTempTabAlarmName(tabId));
});

// ============================================================================
// Types
// ============================================================================

interface SpaFetchParams {
  url?: string;
  maxScrolls?: number;
  scrollDelay?: number;
  waitForSelector?: string;
  waitTimeout?: number;
  extractHtml?: boolean;
  tabId?: number;
  windowId?: number;
  background?: boolean;
}

// ============================================================================
// SPA Fetch Tool
// ============================================================================

class SpaFetchTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SPA_FETCH;

  async execute(args: SpaFetchParams): Promise<ToolResult> {
    const {
      url,
      maxScrolls = DEFAULT_MAX_SCROLLS,
      scrollDelay = DEFAULT_SCROLL_DELAY_MS,
      waitForSelector,
      waitTimeout = DEFAULT_WAIT_TIMEOUT_MS,
      extractHtml = false,
    } = args;
    let temporaryTabId: number | null = null;

    try {
      // ── Step 1: Navigate to the URL ──────────────────────────────
      let tab: chrome.tabs.Tab;
      const background = args.background === true;

      if (url) {
        if (typeof args.tabId === 'number') {
          tab = await this.resolveTargetTab(args.tabId, args.windowId);
          await chrome.tabs.update(tab.id!, { url });
        } else {
          tab = await chrome.tabs.create({
            url,
            active: !background,
            ...(typeof args.windowId === 'number' ? { windowId: args.windowId } : {}),
          });
          if (typeof tab.id === 'number') temporaryTabId = tab.id;
        }

        if (typeof tab.id !== 'number') {
          return createErrorResponse('Failed to get tab ID after navigation');
        }
        if (!background) {
          await this.ensureFocus(tab, { activate: true, focusWindow: true });
        }
        tab = await this.waitForTabReady(tab.id, waitTimeout);
      } else {
        tab = await this.resolveTargetTab(args.tabId, args.windowId);
        if (!background) {
          await this.ensureFocus(tab, { activate: true, focusWindow: true });
        }
      }

      if (typeof tab.id !== 'number') {
        return createErrorResponse('Target tab has no ID');
      }

      // ── Step 2: Wait for page to render ──────────────────────────
      await this.waitForPageRender(tab.id, waitForSelector, waitTimeout);

      // ── Step 3: Scroll to trigger lazy content loading ────────────
      const scrollsPerformed = await this.scrollToLoadContent(tab.id, maxScrolls, scrollDelay);

      // ── Step 4: Inject content script & extract text ──────────────
      await this.injectContentScript(tab.id, ['inject-scripts/web-fetcher-helper.js']);

      const textResponse = await this.sendMessageToTab(tab.id, {
        action: TOOL_MESSAGE_TYPES.WEB_FETCHER_GET_TEXT_CONTENT,
      });

      // Build result
      const result: Record<string, unknown> = {
        success: true,
        url: tab.url || url || '',
        title: tab.title || '',
        tabId: tab.id,
        windowId: tab.windowId,
        active: tab.active === true,
        background,
        scrollsPerformed,
        reachedMaxScrolls: scrollsPerformed >= maxScrolls,
      };

      if (textResponse?.success) {
        result.textContent = textResponse.textContent || '';
        if (textResponse.article) {
          result.article = {
            title: textResponse.article.title,
            byline: textResponse.article.byline,
            siteName: textResponse.article.siteName,
            excerpt: textResponse.article.excerpt,
            lang: textResponse.article.lang,
          };
        }
        if (textResponse.metadata) {
          result.metadata = textResponse.metadata;
        }
      } else {
        result.textContent = '';
        result.extractionError = textResponse?.error || 'Failed to extract text content';
      }

      // Optionally extract HTML
      if (extractHtml) {
        const htmlResponse = await this.sendMessageToTab(tab.id, {
          action: TOOL_MESSAGE_TYPES.WEB_FETCHER_GET_HTML_CONTENT,
        });
        if (htmlResponse?.success) {
          result.htmlContent = htmlResponse.htmlContent;
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `SPA fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (temporaryTabId !== null) {
        await scheduleSpaFetchTabCleanup(temporaryTabId).catch(() => undefined);
      }
    }
  }

  /**
   * Wait for the page to finish rendering — either a specific selector
   * or a general stabilization delay.
   */
  private async waitForPageRender(
    tabId: number,
    waitForSelector?: string,
    waitTimeout = DEFAULT_WAIT_TIMEOUT_MS,
  ): Promise<void> {
    if (waitForSelector) {
      const start = Date.now();
      while (Date.now() - start < waitTimeout) {
        const found = await this.cdpEval(
          tabId,
          `document.querySelector(${JSON.stringify(waitForSelector)}) !== null`,
        );
        if (found === true) return;
        await this.delay(POLL_INTERVAL_MS);
      }
      // Timeout — proceed with whatever content is available
      return;
    }

    // General wait: body + readyState === "complete"
    const start = Date.now();
    while (Date.now() - start < 10_000) {
      const ready = await this.cdpEval(
        tabId,
        'document.body !== null && document.readyState === "complete"',
      );
      if (ready === true) break;
      await this.delay(300);
    }

    // Extra stabilization for SPA frameworks (React, Vue, etc.)
    await this.delay(POST_NAVIGATION_STABILIZE_MS);
  }

  /**
   * Scroll the page in steps to trigger lazy content loading.
   * Returns the actual number of scrolls performed.
   */
  private async scrollToLoadContent(
    tabId: number,
    maxScrolls: number,
    scrollDelay: number,
  ): Promise<number> {
    let scrolls = 0;

    for (let i = 0; i < maxScrolls; i++) {
      // Check if we're already at the bottom (skip check on first pass)
      if (i > 0) {
        const atBottom = await this.cdpEval(
          tabId,
          `(() => {
            const d = document.scrollingElement || document.documentElement || document.body;
            return d ? (d.scrollHeight - d.scrollTop - d.clientHeight <= 50) : true;
          })()`,
        );
        if (atBottom === true) break;
      }

      // Scroll down by a step
      await this.cdpEval(
        tabId,
        `(() => {
          const d = document.scrollingElement || document.documentElement || document.body;
          if (d) {
            const target = Math.min(d.scrollTop + ${SCROLL_STEP_PX}, d.scrollHeight - d.clientHeight);
            d.scrollTop = target;
          }
        })()`,
      );

      scrolls++;

      // Wait for lazy content to load
      await this.delay(scrollDelay);
      await this.delay(POST_SCROLL_STABILIZE_MS);
    }

    // One final scroll-to-bottom
    await this.cdpEval(
      tabId,
      `(() => {
        const d = document.scrollingElement || document.documentElement || document.body;
        if (d) d.scrollTop = d.scrollHeight;
      })()`,
    );
    await this.delay(POST_SCROLL_STABILIZE_MS);

    return scrolls;
  }

  /**
   * Evaluate a JS expression in the page via CDP Runtime.evaluate.
   */
  private async cdpEval(tabId: number, expression: string): Promise<any> {
    try {
      const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, () =>
        cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
          timeout: 5_000,
        }),
      );
      if (response?.exceptionDetails) {
        return null;
      }
      return response?.result?.value;
    } catch {
      return null;
    }
  }

  /**
   * Promise-based delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const spaFetchTool = new SpaFetchTool();
