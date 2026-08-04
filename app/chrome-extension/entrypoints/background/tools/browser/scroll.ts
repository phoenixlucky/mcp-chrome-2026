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
const DEFAULT_SCROLL_STEPS = 1;
const HUMAN_SCROLL_AMOUNT = 600;
const HUMAN_SCROLL_STEPS = 10;
const HUMAN_SCROLL_INTERVAL_MS = 150;
const MAX_SCROLL_STEPS = 50;
const MAX_SCROLL_INTERVAL_MS = 2_000;
const MAX_SLOW_SCROLL_DURATION_MS = 9_000;
const DEFAULT_LAZY_LOAD_STEP = 400;
const DEFAULT_LAZY_LOAD_WAIT_MS = 800;
const DEFAULT_LAZY_LOAD_MAX_STEPS = 1;
// ponytail: keep each MCP request below 2s; repeat chrome_scroll until atBottom is true.
const MAX_LAZY_LOAD_DURATION_MS = 1_500;

// ============================================================================
// Types
// ============================================================================

type ScrollDirection = 'down' | 'up' | 'left' | 'right';
type ScrollMode = 'fast' | 'human';
type ScrollBlock = 'start' | 'center' | 'end' | 'nearest';
type ScrollBehavior = 'auto' | 'smooth';

interface ScrollToolParams {
  amount?: number;
  direction?: ScrollDirection;
  mode?: ScrollMode;
  steps?: number;
  intervalMs?: number;
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
  anchorSelector?: string;
  frameSelector?: string;
  tabId?: number;
  windowId?: number;
}

interface ScrollStateToolParams {
  containerSelector?: string;
  anchorSelector?: string;
  frameSelector?: string;
  tabId?: number;
  windowId?: number;
}

interface PixelScrollPlan {
  deltaX: number;
  deltaY: number;
  steps: number;
  intervalMs: number;
}

function getPixelScrollPlan(params: ScrollToolParams): PixelScrollPlan {
  const mode = params.mode || 'fast';
  const px =
    typeof params.amount === 'number'
      ? params.amount
      : mode === 'human'
        ? HUMAN_SCROLL_AMOUNT
        : DEFAULT_SCROLL_AMOUNT;
  const dir = params.direction || 'down';
  const humanScale = Math.abs(px) / HUMAN_SCROLL_AMOUNT;
  const defaultSteps =
    mode === 'human' ? Math.round(HUMAN_SCROLL_STEPS * humanScale) : DEFAULT_SCROLL_STEPS;
  const defaultIntervalMs =
    mode === 'human' ? Math.round(HUMAN_SCROLL_INTERVAL_MS * humanScale) : 0;
  const rawSteps =
    typeof params.steps === 'number' && Number.isFinite(params.steps)
      ? Math.floor(params.steps)
      : defaultSteps;
  const steps = Math.min(MAX_SCROLL_STEPS, Math.max(1, rawSteps));
  const rawIntervalMs =
    typeof params.intervalMs === 'number' && Number.isFinite(params.intervalMs)
      ? Math.floor(params.intervalMs)
      : defaultIntervalMs;
  const requestedIntervalMs = Math.min(MAX_SCROLL_INTERVAL_MS, Math.max(0, rawIntervalMs));
  const intervalMs = Math.min(
    requestedIntervalMs,
    Math.floor(MAX_SLOW_SCROLL_DURATION_MS / Math.max(steps - 1, 1)),
  );

  return {
    deltaX: dir === 'left' ? -Math.abs(px) : dir === 'right' ? px : 0,
    deltaY: dir === 'up' ? -Math.abs(px) : dir === 'down' ? px : 0,
    steps,
    intervalMs,
  };
}

// ============================================================================
// JS Injection Helpers
// ============================================================================

/**
 * Build and return the scroll JS expression to evaluate in the page.
 * The expression returns { scrollTop, scrollHeight, clientHeight, scrolled }
 * or an error object.
 */
function buildScrollContainerExpression(
  containerSelector?: string,
  anchorSelector?: string,
): string {
  return containerSelector
    ? `doc.querySelector(${JSON.stringify(containerSelector)})`
    : `(() => {
    const selected = ${anchorSelector ? `Array.from(doc.querySelectorAll(${JSON.stringify(anchorSelector)}))` : '[]'};
    const anchors = [...selected, doc.activeElement,
      ...[0.35, 0.5, 0.65].map(x => doc.elementFromPoint(win.innerWidth * x, win.innerHeight / 2))].filter(Boolean);
    const isScrollable = el => el?.isConnected && el.scrollHeight > el.clientHeight
      && (el === doc.scrollingElement || /auto|scroll/.test(win.getComputedStyle(el).overflowY));
    const cached = win.__mcpChromeScrollRoot;
    let container = cached !== doc.scrollingElement && isScrollable(cached)
      && anchors.some(anchor => cached.contains(anchor)) ? cached : null;
    for (const anchor of anchors) {
      for (let el = anchor; !container && el && el !== doc.body; el = el.parentElement) {
        if (isScrollable(el)) container = el;
      }
    }
    container ||= doc.scrollingElement || doc.documentElement;
    win.__mcpChromeScrollRoot = container;
    return container;
  })()`;
}

function buildScrollExpression(params: ScrollToolParams): string {
  const {
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
    anchorSelector,
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
  const containerExpr = buildScrollContainerExpression(containerSelector, anchorSelector);

  // Build scroll action
  const actions: string[] = [];

  if (toBottom && lazyLoad) {
    const step = Math.max(1, lazyLoadStep || DEFAULT_LAZY_LOAD_STEP);
    const waitMs = Math.min(
      MAX_LAZY_LOAD_DURATION_MS,
      Math.max(0, lazyLoadWaitMs ?? DEFAULT_LAZY_LOAD_WAIT_MS),
    );
    const maxSteps = Math.min(
      Math.max(1, lazyLoadMaxSteps || DEFAULT_LAZY_LOAD_MAX_STEPS),
      Math.max(1, Math.floor(MAX_LAZY_LOAD_DURATION_MS / Math.max(waitMs, 1))),
    );
    actions.push(`await (async () => {
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
    actions.push(`c.scrollTop = c.scrollHeight`);
  } else if (toTop) {
    // Scroll to top
    actions.push(`c.scrollTop = 0`);
  } else if (selector && scrollIntoView !== false) {
    // Scroll element into view
    const elExpr = `c.querySelector(${JSON.stringify(selector)})`;
    actions.push(`(($el) => {
      if (!$el) throw new Error('Element not found: ${JSON.stringify(selector)}');
      $el.scrollIntoView({ behavior: ${JSON.stringify(behavior || 'auto')}, block: ${JSON.stringify(block || 'center')} });
    })(${elExpr})`);
  } else if (selector) {
    // Set scrollTop to element's offsetTop
    const elExpr = `c.querySelector(${JSON.stringify(selector)})`;
    actions.push(`(($el, $container) => {
      if (!$el) throw new Error('Element not found: ${JSON.stringify(selector)}');
      $container.scrollTop = $el.offsetTop - $container.offsetTop;
    })(${elExpr}, c)`);
  } else {
    // Pixel scroll
    const {
      deltaX,
      deltaY,
      steps: scrollSteps,
      intervalMs: scrollIntervalMs,
    } = getPixelScrollPlan(params);
    actions.push(`for (let i = 0; i < ${scrollSteps}; i++) {
      c.scrollLeft += ${deltaX} / ${scrollSteps};
      c.scrollTop += ${deltaY} / ${scrollSteps};
      if (i < ${scrollSteps - 1} && ${scrollIntervalMs} > 0) {
        await new Promise(resolve => setTimeout(resolve, ${scrollIntervalMs}));
      }
    }`);
  }

  // Build return statement
  const fullExpression = `
 (async () => {
  try {
    ${framePrelude}
    const c = ${containerExpr};
    if (!c) return JSON.stringify({ success: false, error: 'Scroll container not found' });
    const beforeTop = c.scrollTop;
    const beforeLeft = c.scrollLeft;
    ${actions.join(';\n    ')};
    return JSON.stringify({
      success: true,
      target: c === doc.scrollingElement ? 'document.scrollingElement' : c.id ? '#' + c.id : c.tagName.toLowerCase(),
      moved: c.scrollTop !== beforeTop || c.scrollLeft !== beforeLeft,
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

function buildScrollMeasurementExpression(
  containerSelector?: string,
  anchorSelector?: string,
): string {
  const containerExpr = buildScrollContainerExpression(containerSelector, anchorSelector);
  return `(async () => {
  try {
    const doc = document;
    const win = window;
    const c = ${containerExpr};
    if (!c) return JSON.stringify({ success: false, error: 'Scroll container not found' });
    return JSON.stringify({
      success: true,
      target: c === doc.scrollingElement ? 'document.scrollingElement' : c.id ? '#' + c.id : c.tagName.toLowerCase(),
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
}

function buildWheelTargetExpression(containerSelector?: string, anchorSelector?: string): string {
  const containerExpr = buildScrollContainerExpression(containerSelector, anchorSelector);
  return `(async () => {
  try {
    const doc = document;
    const win = window;
    const c = ${containerExpr};
    if (!c) return JSON.stringify({ success: false, error: 'Scroll container not found' });
    const rect = c === doc.scrollingElement
      ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
      : c.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return JSON.stringify({ success: false, error: 'Scroll container is not visible' });
    }
    return JSON.stringify({
      success: true,
      x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
      scrollTop: c.scrollTop,
      scrollLeft: c.scrollLeft,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message || String(e) });
  }
})()`;
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

      // 2. Use native wheel input for pixel scrolling; special modes keep the direct path.
      const isPixelScroll = !args.toBottom && !args.toTop && !args.selector && !args.frameSelector;
      const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
        if (!isPixelScroll) {
          return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
            expression: buildScrollExpression(args),
            returnByValue: true,
            awaitPromise: true,
            timeout: DEFAULT_TIMEOUT_MS,
          });
        }

        const targetResponse = await cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression: buildWheelTargetExpression(args.containerSelector, args.anchorSelector),
          returnByValue: true,
          awaitPromise: true,
          timeout: DEFAULT_TIMEOUT_MS,
        });
        const targetValue = targetResponse?.result?.value;
        const target = typeof targetValue === 'string' ? JSON.parse(targetValue) : null;

        if (!target?.success) {
          return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
            expression: buildScrollExpression(args),
            returnByValue: true,
            awaitPromise: true,
            timeout: DEFAULT_TIMEOUT_MS,
          });
        }

        const before = target;
        const plan = getPixelScrollPlan(args);
        let previousEased = 0;

        // ponytail: fixed cubic ease-out; use device-specific curves only if realism needs tuning.
        for (let i = 0; i < plan.steps; i++) {
          const progress = (i + 1) / plan.steps;
          const eased = 1 - (1 - progress) ** 3;
          const factor = eased - previousEased;
          await cdpSessionManager.sendCommand(tabId, 'Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: target.x,
            y: target.y,
            deltaX: plan.deltaX * factor,
            deltaY: plan.deltaY * factor,
          });
          previousEased = eased;
          if (i < plan.steps - 1 && plan.intervalMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, plan.intervalMs));
          }
        }

        const afterResponse = await cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression: buildScrollMeasurementExpression(args.containerSelector, args.anchorSelector),
          returnByValue: true,
          awaitPromise: true,
          timeout: DEFAULT_TIMEOUT_MS,
        });
        const afterValue = afterResponse?.result?.value;
        const after = typeof afterValue === 'string' ? JSON.parse(afterValue) : null;
        if (!after?.success) {
          return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
            expression: buildScrollExpression(args),
            returnByValue: true,
            awaitPromise: true,
            timeout: DEFAULT_TIMEOUT_MS,
          });
        }

        const moved =
          before?.scrollTop !== after.scrollTop || before?.scrollLeft !== after.scrollLeft;
        if (!moved) {
          return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
            expression: buildScrollExpression(args),
            returnByValue: true,
            awaitPromise: true,
            timeout: DEFAULT_TIMEOUT_MS,
          });
        }

        return {
          result: {
            value: JSON.stringify({
              ...after,
              moved,
            }),
          },
        };
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
              target: result.target,
              moved: result.moved,
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

function buildScrollStateExpression(params: ScrollStateToolParams): string {
  const framePrelude = params.frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(params.frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${params.frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${params.frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';
  const containerExpr = buildScrollContainerExpression(
    params.containerSelector,
    params.anchorSelector,
  );

  return `(async () => {
    try {
      ${framePrelude}
      const c = ${containerExpr};
      if (!c) return JSON.stringify({ success: false, error: 'Scroll container not found' });
      const maxY = Math.max(0, c.scrollHeight - c.clientHeight);
      return JSON.stringify({
        success: true,
        target: c === doc.scrollingElement ? 'document.scrollingElement' : c.id ? '#' + c.id : c.tagName.toLowerCase(),
        y: c.scrollTop,
        maxY,
        atTop: c.scrollTop <= 0,
        atBottom: c.scrollTop >= maxY,
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message || String(e) });
    }
  })()`;
}

class ScrollStateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_SCROLL_STATE;

  async execute(args: ScrollStateToolParams): Promise<ToolResult> {
    try {
      const tab = args.tabId
        ? await this.tryGetTab(args.tabId)
        : args.windowId
          ? await this.getActiveTabInWindow(args.windowId)
          : await this.getActiveTabOrThrow();
      if (!tab?.id)
        return createErrorResponse(
          args.tabId ? `Tab ${args.tabId} not found` : 'No active tab found',
        );

      const response = await cdpSessionManager.withSession(tab.id, CDP_SESSION_KEY, () =>
        cdpSessionManager.sendCommand(tab.id!, 'Runtime.evaluate', {
          expression: buildScrollStateExpression(args),
          returnByValue: true,
          awaitPromise: true,
          timeout: DEFAULT_TIMEOUT_MS,
        }),
      );
      if (response?.exceptionDetails) {
        return createErrorResponse(
          `Get scroll state failed: ${response.exceptionDetails.text || 'execution failed'}`,
        );
      }
      if (typeof response?.result?.value !== 'string') {
        return createErrorResponse('Get scroll state returned unexpected result');
      }

      const result = JSON.parse(response.result.value);
      if (!result.success) return createErrorResponse(`Get scroll state failed: ${result.error}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
    } catch (error) {
      return createErrorResponse(
        `Get scroll state failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const scrollStateTool = new ScrollStateTool();
