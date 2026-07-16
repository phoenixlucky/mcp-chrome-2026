/**
 * Scroll Tool - chrome_scroll
 *
 * Scroll the page or a scrollable container in various ways:
 * - Pixel scroll: specify amount + optional direction
 * - Edge scroll: toBottom / toTop
 * - Element scroll: scroll element into view via selector
 *
 * Supports auto-detection of the main scroll container by walking
 * ancestor elements' overflow styles (X Collector pattern).
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 10_000;
const CDP_SESSION_KEY = 'scroll';
const DEFAULT_SCROLL_AMOUNT = 300;
const DEFAULT_LAZY_LOAD_STEP = 400;
const DEFAULT_LAZY_LOAD_WAIT_MS = 800;
const DEFAULT_LAZY_LOAD_MAX_STEPS = 100;

// ============================================================================
// Types
// ============================================================================

type ScrollDirection = 'down' | 'up' | 'left' | 'right';
type ScrollBlock = 'start' | 'center' | 'end' | 'nearest';
type ScrollBehavior = 'auto' | 'smooth';

interface ScrollToolParams {
  amount?: number;
  direction?: ScrollDirection;
  toBottom?: boolean;
  lazyLoad?: boolean;
  lazyLoadStep?: number;
  lazyLoadWaitMs?: number;
  lazyLoadMaxSteps?: number;
  toTop?: boolean;
  selector?: string;
  scrollIntoView?: boolean;
  block?: ScrollBlock;
  behavior?: ScrollBehavior;
  containerSelector?: string;
  frameSelector?: string;
  tabId?: number;
  windowId?: number;
}

// ============================================================================
// JS Injection Helpers
// ============================================================================

/**
 * Build and return the scroll JS expression to evaluate in the page.
 * The expression returns { scrollTop, scrollHeight, clientHeight, scrolled }
 * or an error object.
 */
function buildScrollExpression(params: ScrollToolParams): string {
  const {
    amount,
    direction,
    toBottom,
    lazyLoad,
    lazyLoadStep,
    lazyLoadWaitMs,
    lazyLoadMaxSteps,
    toTop,
    selector,
    scrollIntoView,
    block,
    behavior,
    containerSelector,
    frameSelector,
  } = params;

  const framePrelude = frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';

  // Determine the container element expression
  const containerExpr = containerSelector
    ? `doc.querySelector(${JSON.stringify(containerSelector)})`
    : `(() => {
    // Auto-detect main scroll container (X Collector pattern)
    const el = doc.scrollingElement || doc.documentElement;
    // Try to find a better scrollable ancestor
    const candidates = [];
    // Walk up from body
    const body = doc.body;
    if (body) {
      let p = body.parentElement;
      while (p && p !== doc.documentElement) {
        const cs = win.getComputedStyle(p);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
          candidates.push(p);
        }
        p = p.parentElement;
      }
    }
    // Also check common SPA root containers
    for (const sel of ['#root', '#app', '#__next', '#__nuxt', '[data-reactroot]', 'main', '[role="main"]']) {
      const el2 = doc.querySelector(sel);
      if (el2) {
        const cs = win.getComputedStyle(el2);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
          candidates.push(el2);
        }
      }
    }
    if (candidates.length > 0) return candidates[0];
    return doc.scrollingElement || doc.documentElement;
  })()`;

  // Build scroll action
  const actions: string[] = [];

  if (toBottom && lazyLoad) {
    const step = Math.max(1, lazyLoadStep || DEFAULT_LAZY_LOAD_STEP);
    const waitMs = Math.max(0, lazyLoadWaitMs ?? DEFAULT_LAZY_LOAD_WAIT_MS);
    const maxSteps = Math.max(1, lazyLoadMaxSteps || DEFAULT_LAZY_LOAD_MAX_STEPS);
    actions.push(`await (async () => {
      const c = ${containerExpr};
      let bottomChecks = 0;
      for (let i = 0; i < ${maxSteps}; i++) {
        const heightBefore = c.scrollHeight;
        c.scrollTop += ${step};
        await new Promise(resolve => setTimeout(resolve, ${waitMs}));
        if (c.scrollTop + c.clientHeight < c.scrollHeight - 1) continue;
        bottomChecks = c.scrollHeight === heightBefore ? bottomChecks + 1 : 0;
        if (bottomChecks >= 2) break;
      }
    })()`);
  } else if (toBottom) {
    // Scroll to bottom
    actions.push(`${containerExpr}.scrollTop = ${containerExpr}.scrollHeight`);
  } else if (toTop) {
    // Scroll to top
    actions.push(`${containerExpr}.scrollTop = 0`);
  } else if (selector && scrollIntoView !== false) {
    // Scroll element into view
    const elExpr = containerSelector
      ? `${containerExpr}.querySelector(${JSON.stringify(selector)})`
      : `doc.querySelector(${JSON.stringify(selector)})`;
    actions.push(`(($el) => {
      if (!$el) throw new Error('Element not found: ${JSON.stringify(selector)}');
      $el.scrollIntoView({ behavior: ${JSON.stringify(behavior || 'auto')}, block: ${JSON.stringify(block || 'center')} });
    })(${elExpr})`);
  } else if (selector) {
    // Set scrollTop to element's offsetTop
    const elExpr = containerSelector
      ? `${containerExpr}.querySelector(${JSON.stringify(selector)})`
      : `doc.querySelector(${JSON.stringify(selector)})`;
    actions.push(`(($el, $container) => {
      if (!$el) throw new Error('Element not found: ${JSON.stringify(selector)}');
      $container.scrollTop = $el.offsetTop - $container.offsetTop;
    })(${elExpr}, ${containerExpr})`);
  } else {
    // Pixel scroll
    const px = typeof amount === 'number' ? amount : DEFAULT_SCROLL_AMOUNT;
    const dir = direction || 'down';
    if (dir === 'down') {
      actions.push(`${containerExpr}.scrollTop += ${px}`);
    } else if (dir === 'up') {
      actions.push(`${containerExpr}.scrollTop -= ${Math.abs(px)}`);
    } else if (dir === 'left') {
      actions.push(`${containerExpr}.scrollLeft -= ${Math.abs(px)}`);
    } else if (dir === 'right') {
      actions.push(`${containerExpr}.scrollLeft += ${px}`);
    }
  }

  // Build return statement
  const fullExpression = `
 (async () => {
  try {
    ${framePrelude}
    ${actions.join(';\n    ')};
    const c = ${containerExpr};
    return JSON.stringify({
      success: true,
      scrollTop: c.scrollTop,
      scrollHeight: c.scrollHeight,
      clientHeight: c.clientHeight,
      scrollLeft: c.scrollLeft,
      scrollWidth: c.scrollWidth,
      clientWidth: c.clientWidth,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message || String(e) });
  }
})()`;

  return fullExpression;
}

// ============================================================================
// Tool Implementation
// ============================================================================

class ScrollTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SCROLL;

  async execute(args: ScrollToolParams): Promise<ToolResult> {
    try {
      // 1. Resolve target tab
      let tabId: number;

      if (args.tabId) {
        const tab = await this.tryGetTab(args.tabId);
        if (!tab) {
          return createErrorResponse(`Tab ${args.tabId} not found`);
        }
        tabId = args.tabId;
      } else if (args.windowId) {
        const tab = await this.getActiveTabInWindow(args.windowId);
        if (!tab || !tab.id) {
          return createErrorResponse(`No active tab found in window ${args.windowId}`);
        }
        tabId = tab.id;
      } else {
        const tab = await this.getActiveTabOrThrow();
        tabId = tab.id!;
      }

      // 2. Build and execute scroll JS via CDP
      const expression = buildScrollExpression(args);
      const timeout = args.lazyLoad
        ? Math.min(
            120_000,
            Math.max(
              10_000,
              (args.lazyLoadMaxSteps || DEFAULT_LAZY_LOAD_MAX_STEPS) *
                (args.lazyLoadWaitMs ?? DEFAULT_LAZY_LOAD_WAIT_MS) +
                10_000,
            ),
          )
        : DEFAULT_TIMEOUT_MS;

      const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
        return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
          timeout,
        });
      });

      // 3. Parse result
      if (response?.exceptionDetails) {
        const msg = response.exceptionDetails.text || 'Scroll execution failed';
        return createErrorResponse(`Scroll failed: ${msg}`);
      }

      const rawValue = response?.result?.value;
      if (typeof rawValue !== 'string') {
        return createErrorResponse('Scroll returned unexpected result');
      }

      const result = JSON.parse(rawValue);

      if (!result.success) {
        return createErrorResponse(`Scroll failed: ${result.error}`);
      }

      // 4. Return scroll state
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              scrollTop: result.scrollTop,
              scrollHeight: result.scrollHeight,
              clientHeight: result.clientHeight,
              scrollLeft: result.scrollLeft,
              scrollWidth: result.scrollWidth,
              clientWidth: result.clientWidth,
              atBottom: result.scrollHeight - result.scrollTop - result.clientHeight < 1,
              atTop: result.scrollTop <= 0,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Scroll failed: ${message}`);
    }
  }
}

export const scrollTool = new ScrollTool();
