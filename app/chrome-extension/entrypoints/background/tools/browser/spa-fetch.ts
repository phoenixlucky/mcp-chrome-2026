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

// ============================================================================
// Types
// ============================================================================

interface SpaFetchParams {
  url: string;
  maxScrolls?: number;
  scrollDelay?: number;
  waitForSelector?: string;
  waitTimeout?: number;
  extractHtml?: boolean;
  tabId?: number;
  windowId?: number;
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

    if (!url) {
      return createErrorResponse('url is required');
    }

    try {
      // ── Step 1: Navigate to the URL ──────────────────────────────
      let tab: chrome.tabs.Tab;

      if (typeof args.tabId === 'number') {
        tab = await chrome.tabs.get(args.tabId);
        await chrome.tabs.update(tab.id!, { url });
      } else {
        tab = await chrome.tabs.create({
          url,
          active: false,
          ...(typeof args.windowId === 'number' ? { windowId: args.windowId } : {}),
        });
      }

      if (!tab.id) {
        return createErrorResponse('Failed to get tab ID after navigation');
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
        url: tab.url || url,
        title: tab.title || '',
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
