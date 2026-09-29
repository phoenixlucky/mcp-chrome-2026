export const DEFAULT_TIMEOUT_MS = 10_000;
export const CDP_SESSION_KEY = 'scroll';
export const DEFAULT_SCROLL_AMOUNT = 300;
export const DEFAULT_SCROLL_STEPS = 1;
export const HUMAN_SCROLL_AMOUNT = 600;
export const HUMAN_SCROLL_PROFILES = {
  human: { steps: 15, intervalMs: 50 },
  humanFast: { steps: 15, intervalMs: 20 },
  humanSlow: { steps: 15, intervalMs: 80 },
} as const;
export const MAX_SCROLL_STEPS = 50;
export const MAX_SCROLL_INTERVAL_MS = 2_000;
export const MAX_SLOW_SCROLL_DURATION_MS = 9_000;
export const HUMAN_LAZY_LOAD_WAIT_MS = 800;
export const HUMAN_LAZY_LOAD_QUIET_MS = 150;
export const BACKGROUND_LAYOUT_RETRY_WAIT_MS = 400;
export const BACKGROUND_DOM_SETTLE_WAIT_MS = 300;
// ponytail: cap one MCP call; repeat while atBottom is false for longer feeds.
export const MAX_HUMAN_TO_BOTTOM_DURATION_MS = 9_000;
export const MAX_HUMAN_TO_BOTTOM_ROUNDS = 50;

// ============================================================================
// Types
// ============================================================================

type ScrollDirection = 'down' | 'up' | 'left' | 'right';
type ScrollMode = 'fast' | keyof typeof HUMAN_SCROLL_PROFILES;
type ScrollBlock = 'start' | 'center' | 'end' | 'nearest';
type ScrollBehavior = 'auto' | 'smooth';

export interface ScrollToolParams {
  amount?: number;
  direction?: ScrollDirection;
  mode?: ScrollMode;
  humanLazyLoad?: boolean;
  steps?: number;
  intervalMs?: number;
  toBottom?: boolean;
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
  background?: boolean;
}

export interface ScrollStateToolParams {
  containerSelector?: string;
  anchorSelector?: string;
  frameSelector?: string;
  tabId?: number;
  windowId?: number;
  background?: boolean;
}

interface PixelScrollPlan {
  deltaX: number;
  deltaY: number;
  steps: number;
  intervalMs: number;
}

export function getPixelScrollPlan(params: ScrollToolParams): PixelScrollPlan {
  const mode = params.mode || 'fast';
  const humanProfile = mode === 'fast' ? undefined : HUMAN_SCROLL_PROFILES[mode];
  const px =
    typeof params.amount === 'number'
      ? params.amount
      : humanProfile
        ? HUMAN_SCROLL_AMOUNT
        : DEFAULT_SCROLL_AMOUNT;
  const dir = params.direction || 'down';
  const humanScale = Math.abs(px) / HUMAN_SCROLL_AMOUNT;
  // Steps scale with distance (a human flicks the wheel more times), but the
  // per-step interval stays constant — real wheel ticks keep a fixed cadence,
  // so total duration grows linearly with distance, not quadratically.
  const defaultSteps = humanProfile
    ? Math.round(humanProfile.steps * humanScale)
    : DEFAULT_SCROLL_STEPS;
  const defaultIntervalMs = humanProfile ? humanProfile.intervalMs : 0;
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

export function isHumanMode(mode?: ScrollMode): boolean {
  return mode === 'human' || mode === 'humanFast' || mode === 'humanSlow';
}

export function buildScrollContainerExpression(
  containerSelector?: string,
  anchorSelector?: string,
  background = false,
): string {
  return containerSelector
    ? `doc.querySelector(${JSON.stringify(containerSelector)})`
    : `(() => {
    const selected = ${anchorSelector ? `Array.from(doc.querySelectorAll(${JSON.stringify(anchorSelector)}))` : '[]'};
    const anchors = [...selected, doc.activeElement,
      ${background ? '' : '...[0.35, 0.5, 0.65].map(x => doc.elementFromPoint(win.innerWidth * x, win.innerHeight / 2))'}].filter(Boolean);
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

export function buildScrollExpression(params: ScrollToolParams, background = false): string {
  const {
    toBottom,
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
  const containerExpr = buildScrollContainerExpression(
    containerSelector,
    anchorSelector,
    background,
  );
  const isHumanToBottom =
    toBottom === true && isHumanMode(params.mode) && !toTop && !selector && !frameSelector;

  // Build scroll action
  const actions: string[] = [];

  if (toBottom && !isHumanToBottom) {
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
    const move = background
      ? `if (typeof c.scrollBy === 'function') c.scrollBy({ left: ${deltaX} / ${scrollSteps}, top: ${deltaY} / ${scrollSteps}, behavior: 'auto' });
      else { c.scrollLeft += ${deltaX} / ${scrollSteps}; c.scrollTop += ${deltaY} / ${scrollSteps}; }`
      : `c.scrollLeft += ${deltaX} / ${scrollSteps};
      c.scrollTop += ${deltaY} / ${scrollSteps};`;
    actions.push(`for (let i = 0; i < ${scrollSteps}; i++) {
      ${move}
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

export function buildScrollMeasurementExpression(
  containerSelector?: string,
  anchorSelector?: string,
  background = false,
  frameSelector?: string,
): string {
  const framePrelude = frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';
  const containerExpr = buildScrollContainerExpression(
    containerSelector,
    anchorSelector,
    background,
  );
  return `(async () => {
  try {
    ${framePrelude}
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
      visibilityState: doc.visibilityState,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message || String(e) });
  }
})()`;
}

export function buildDomScrollStepExpression(
  containerSelector: string | undefined,
  anchorSelector: string | undefined,
  frameSelector: string | undefined,
  deltaX: number,
  deltaY: number,
): string {
  const framePrelude = frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';
  const containerExpr = buildScrollContainerExpression(containerSelector, anchorSelector, true);
  return `(async () => {
  try {
    ${framePrelude}
    const c = ${containerExpr};
    if (!c) return JSON.stringify({ success: false, error: 'Scroll container not found' });
    const beforeTop = c.scrollTop;
    const beforeLeft = c.scrollLeft;
    if (typeof c.scrollBy === 'function') {
      c.scrollBy({ left: ${deltaX}, top: ${deltaY}, behavior: 'auto' });
    } else {
      c.scrollLeft += ${deltaX};
      c.scrollTop += ${deltaY};
    }
    return JSON.stringify({
      success: true,
      moved: c.scrollTop !== beforeTop || c.scrollLeft !== beforeLeft,
      scrollTop: c.scrollTop,
      scrollHeight: c.scrollHeight,
      clientHeight: c.clientHeight,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message || String(e) });
  }
})()`;
}

export function buildWheelTargetExpression(
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

export function buildHumanLazyLoadStartExpression(
  containerSelector?: string,
  anchorSelector?: string,
  background = false,
  frameSelector?: string,
): string {
  // ponytail: generic DOM/layout/resource signals; add page-specific loading selectors only when needed.
  const containerExpr = buildScrollContainerExpression(
    containerSelector,
    anchorSelector,
    background,
  );
  const framePrelude = frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';
  return `(() => {
  ${framePrelude}
  const c = ${containerExpr};
  win.__mcpChromeHumanLazyLoad?.cleanup?.();
  if (!c) return false;

  const state = {
    done: false,
    changed: false,
    reason: 'timeout',
    resolve: null,
    cleanup: null,
    promise: null,
    result: null,
  };
  const root = c === doc.scrollingElement ? doc.documentElement : c;
  const baseline = { height: c.scrollHeight, children: c.childElementCount };
  let quietTimer;
  let deadlineTimer;
  const mutationObserver = new MutationObserver(() => {
    state.changed = true;
    scheduleQuiet('dom');
  });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (c.scrollHeight !== baseline.height || c.childElementCount !== baseline.children) {
      state.changed = true;
      scheduleQuiet('layout');
    }
  }) : null;
  const performanceObserver = typeof PerformanceObserver === 'function' ? new PerformanceObserver(() => {
    state.changed = true;
    scheduleQuiet('network');
  }) : null;
  const finish = (reason) => {
    if (state.done) return;
    state.done = true;
    state.reason = reason;
    state.result = { changed: state.changed, reason };
    clearTimeout(quietTimer);
    clearTimeout(deadlineTimer);
    clearInterval(pollTimer);
    mutationObserver.disconnect();
    resizeObserver?.disconnect();
    performanceObserver?.disconnect();
    state.resolve?.(state.result);
  };
  const scheduleQuiet = (reason) => {
    state.reason = reason;
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      const busy = root.querySelector?.('[aria-busy="true"], [data-loading="true"]');
      if (busy) return scheduleQuiet('loading');
      finish(reason);
    }, ${HUMAN_LAZY_LOAD_QUIET_MS});
  };
  const pollTimer = setInterval(() => {
    if (c.scrollHeight !== baseline.height || c.childElementCount !== baseline.children) {
      state.changed = true;
      scheduleQuiet('layout');
    }
  }, 50);
  mutationObserver.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
  resizeObserver?.observe(c);
  try { performanceObserver?.observe({ type: 'resource', buffered: false }); } catch {}
  state.promise = new Promise(resolve => { state.resolve = resolve; });
  state.cleanup = () => finish('cancelled');
  win.__mcpChromeHumanLazyLoad = state;
  deadlineTimer = setTimeout(() => finish('timeout'), ${HUMAN_LAZY_LOAD_WAIT_MS});
  return true;
})()`;
}

export function buildHumanLazyLoadWaitExpression(frameSelector?: string): string {
  const hostWindow = frameSelector
    ? `(document.querySelector(${JSON.stringify(frameSelector)})?.contentWindow || window)`
    : 'window';
  return `(() => {
  const hostWin = ${hostWindow};
  const state = hostWin.__mcpChromeHumanLazyLoad;
  if (!state) return { changed: false, reason: 'not-started' };
  if (state.done) {
    delete hostWin.__mcpChromeHumanLazyLoad;
    return state.result;
  }
  return state.promise.then(result => {
    delete hostWin.__mcpChromeHumanLazyLoad;
    return result;
  });
})()`;
}

// ============================================================================
// Tool Implementation
// ============================================================================

export function buildScrollStateExpression(
  params: ScrollStateToolParams,
  background = false,
): string {
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
    background,
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
        ${background ? 'scrollHeight: c.scrollHeight, clientHeight: c.clientHeight, visibilityState: doc.visibilityState,' : ''}
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message || String(e) });
    }
  })()`;
}
