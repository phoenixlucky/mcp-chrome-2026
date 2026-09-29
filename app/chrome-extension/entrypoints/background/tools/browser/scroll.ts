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

import {
  BACKGROUND_DOM_SETTLE_WAIT_MS,
  BACKGROUND_LAYOUT_RETRY_WAIT_MS,
  CDP_SESSION_KEY,
  DEFAULT_SCROLL_AMOUNT,
  DEFAULT_SCROLL_STEPS,
  DEFAULT_TIMEOUT_MS,
  HUMAN_LAZY_LOAD_QUIET_MS,
  HUMAN_LAZY_LOAD_WAIT_MS,
  HUMAN_SCROLL_AMOUNT,
  HUMAN_SCROLL_PROFILES,
  MAX_HUMAN_TO_BOTTOM_DURATION_MS,
  MAX_HUMAN_TO_BOTTOM_ROUNDS,
  MAX_SCROLL_INTERVAL_MS,
  MAX_SCROLL_STEPS,
  MAX_SLOW_SCROLL_DURATION_MS,
  buildDomScrollStepExpression,
  buildHumanLazyLoadStartExpression,
  buildHumanLazyLoadWaitExpression,
  buildScrollContainerExpression,
  buildScrollExpression,
  buildScrollMeasurementExpression,
  buildScrollStateExpression,
  buildWheelTargetExpression,
  getPixelScrollPlan,
  isHumanMode,
  type ScrollStateToolParams,
  type ScrollToolParams,
} from './scroll-expressions';
export { buildScrollContainerExpression } from './scroll-expressions';

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import {
  CdpCommandCancelledError,
  CdpCommandTimeoutError,
  cdpSessionManager,
} from '@/utils/cdp-session-manager';
import { ensureTabRendering, resolveBackgroundMode } from './common';

// ============================================================================
// Constants
// ============================================================================

function waitForScrollInterval(intervalMs: number, signal?: AbortSignal): Promise<void> {
  if (intervalMs <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Scroll cancelled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, intervalMs);
    if (!signal) return;
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

function formatScrollCdpError(error: unknown): string | null {
  if (error instanceof CdpCommandTimeoutError) {
    return JSON.stringify({
      success: false,
      error: {
        kind: 'cdp_timeout',
        type: 'timeout',
        tabId: error.tabId,
        method: error.method,
        timeoutMs: error.timeoutMs,
        executionState: 'unknown',
        message: error.message,
      },
    });
  }
  if (error instanceof CdpCommandCancelledError) {
    return JSON.stringify({
      success: false,
      error: {
        kind: 'cancelled',
        type: 'cancelled',
        tabId: error.tabId,
        method: error.method,
        executionState: 'unknown',
        message: error.message,
      },
    });
  }
  return null;
}

// ============================================================================
// JS Injection Helpers
// ============================================================================

/**
 * Build and return the scroll JS expression to evaluate in the page.
 * The expression returns { scrollTop, scrollHeight, clientHeight, scrolled }
 * or an error object.
 */
function parseRuntimeValue(response: any): Record<string, any> | null {
  const value = response?.result?.value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isZeroBackgroundLayout(value: Record<string, any> | null): boolean {
  const scrollTop = value?.scrollTop ?? value?.y;
  const noDimensions =
    value?.scrollHeight === 0 && value?.clientHeight === 0
      ? true
      : value?.maxY === 0 && value?.scrollHeight === undefined;
  return Boolean(value?.success && scrollTop === 0 && noDimensions);
}

function backgroundLayoutUnavailable(value: Record<string, any>) {
  return {
    result: {
      value: JSON.stringify({
        success: false,
        code: 'BACKGROUND_LAYOUT_UNAVAILABLE',
        retryable: true,
        scrollHeight: value.scrollHeight || 0,
        clientHeight: value.clientHeight || 0,
        visibilityState: value.visibilityState || 'hidden',
      }),
    },
  };
}

class ScrollTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SCROLL;

  async execute(args: ScrollToolParams, signal?: AbortSignal): Promise<ToolResult> {
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

      const background = await resolveBackgroundMode(tabId, args.background);

      // 2. Use native wheel input unless background mode was requested or required.
      const isHumanToBottom =
        args.toBottom === true &&
        isHumanMode(args.mode) &&
        !args.toTop &&
        !args.selector &&
        !args.frameSelector;
      const isPixelScroll =
        isHumanToBottom || (!args.toBottom && !args.toTop && !args.selector && !args.frameSelector);
      const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
        const sendCdp = <T = any>(method: string, params?: object) =>
          cdpSessionManager.sendCommand<T>(tabId, method, params, {
            timeoutMs: DEFAULT_TIMEOUT_MS,
            signal,
          });

        if (background) {
          await ensureTabRendering(tabId, { timeoutMs: DEFAULT_TIMEOUT_MS, signal });

          const measure = async () => {
            const measured = await sendCdp('Runtime.evaluate', {
              expression: buildScrollMeasurementExpression(
                args.containerSelector,
                args.anchorSelector,
                true,
                args.frameSelector,
              ),
              returnByValue: true,
              awaitPromise: true,
            });
            return parseRuntimeValue(measured);
          };
          let before = await measure();
          if (isZeroBackgroundLayout(before)) {
            await waitForScrollInterval(BACKGROUND_LAYOUT_RETRY_WAIT_MS, signal);
            await ensureTabRendering(tabId, { timeoutMs: DEFAULT_TIMEOUT_MS, signal });
            before = await measure();
          }
          if (isZeroBackgroundLayout(before)) return backgroundLayoutUnavailable(before!);

          const humanLazyLoad = isHumanMode(args.mode) && args.humanLazyLoad === true;
          if (!isPixelScroll) {
            let after = before;
            let moved = false;
            let stableBottomRounds = 0;
            let noMoveRounds = 0;
            const startedAt = Date.now();
            const maxRounds = args.toBottom ? MAX_HUMAN_TO_BOTTOM_ROUNDS : 1;
            for (let round = 0; round < maxRounds; round += 1) {
              if (humanLazyLoad) {
                await sendCdp('Runtime.evaluate', {
                  expression: buildHumanLazyLoadStartExpression(
                    args.containerSelector,
                    args.anchorSelector,
                    true,
                    args.frameSelector,
                  ),
                  returnByValue: true,
                  awaitPromise: false,
                });
              }
              const actionResponse = await sendCdp('Runtime.evaluate', {
                expression: buildScrollExpression(args, true),
                returnByValue: true,
                awaitPromise: true,
              });
              const action = parseRuntimeValue(actionResponse);
              if (action && action.success === false) return actionResponse;
              if (humanLazyLoad) {
                await sendCdp('Runtime.evaluate', {
                  expression: buildHumanLazyLoadWaitExpression(args.frameSelector),
                  returnByValue: true,
                  awaitPromise: true,
                });
              } else if (args.toBottom) {
                await waitForScrollInterval(BACKGROUND_DOM_SETTLE_WAIT_MS, signal);
              }
              after = await measure();
              if (isZeroBackgroundLayout(after)) {
                await waitForScrollInterval(BACKGROUND_LAYOUT_RETRY_WAIT_MS, signal);
                after = await measure();
              }
              if (!after) return actionResponse;
              if (isZeroBackgroundLayout(after)) return backgroundLayoutUnavailable(after);
              const movedThisRound =
                before?.scrollTop !== after.scrollTop || before?.scrollLeft !== after.scrollLeft;
              moved ||= movedThisRound;
              if (!args.toBottom) break;
              const atBottom = after.scrollHeight - after.scrollTop - after.clientHeight < 1;
              noMoveRounds = movedThisRound ? 0 : noMoveRounds + 1;
              if (!movedThisRound && !atBottom && noMoveRounds >= 2) break;
              if (atBottom && after.scrollHeight === before?.scrollHeight) {
                stableBottomRounds += 1;
                if (stableBottomRounds >= 2) break;
              } else {
                stableBottomRounds = 0;
              }
              if (Date.now() - startedAt >= MAX_HUMAN_TO_BOTTOM_DURATION_MS) break;
              before = after;
            }
            return { result: { value: JSON.stringify({ ...after, moved }) } };
          }

          const plan = isHumanToBottom
            ? getPixelScrollPlan({
                ...args,
                amount: Math.abs(args.amount ?? 600),
                direction: 'down',
              })
            : getPixelScrollPlan(args);
          let after = before;
          let moved = false;
          let stableBottomRounds = 0;
          let noMoveRounds = 0;
          const startedAt = Date.now();
          const maxRounds = isHumanToBottom ? MAX_HUMAN_TO_BOTTOM_ROUNDS : 2;

          for (let round = 0; round < maxRounds; round += 1) {
            if (humanLazyLoad) {
              await sendCdp('Runtime.evaluate', {
                expression: buildHumanLazyLoadStartExpression(
                  args.containerSelector,
                  args.anchorSelector,
                  true,
                  args.frameSelector,
                ),
                returnByValue: true,
                awaitPromise: false,
              });
            }
            let previousEased = 0;
            for (let step = 0; step < plan.steps; step += 1) {
              const progress = (step + 1) / plan.steps;
              const eased = isHumanToBottom ? 1 - (1 - progress) ** 3 : progress;
              const factor = eased - previousEased;
              const actionResponse = await sendCdp('Runtime.evaluate', {
                expression: buildDomScrollStepExpression(
                  args.containerSelector,
                  args.anchorSelector,
                  args.frameSelector,
                  plan.deltaX * factor,
                  plan.deltaY * factor,
                ),
                returnByValue: true,
                awaitPromise: true,
              });
              const action = parseRuntimeValue(actionResponse);
              if (action && action.success === false) return actionResponse;
              previousEased = eased;
              if (step < plan.steps - 1 && plan.intervalMs > 0) {
                await waitForScrollInterval(plan.intervalMs, signal);
              }
            }
            if (humanLazyLoad) {
              await sendCdp('Runtime.evaluate', {
                expression: buildHumanLazyLoadWaitExpression(args.frameSelector),
                returnByValue: true,
                awaitPromise: true,
              });
            }
            after = await measure();
            if (isZeroBackgroundLayout(after)) {
              await waitForScrollInterval(BACKGROUND_LAYOUT_RETRY_WAIT_MS, signal);
              after = await measure();
            }
            if (!after)
              return {
                result: {
                  value: JSON.stringify({
                    success: false,
                    error: 'Scroll measurement unavailable',
                  }),
                },
              };
            if (isZeroBackgroundLayout(after)) return backgroundLayoutUnavailable(after!);

            const movedThisRound =
              before?.scrollTop !== after?.scrollTop || before?.scrollLeft !== after?.scrollLeft;
            moved ||= movedThisRound;
            const atBottom = after.scrollHeight - after.scrollTop - after.clientHeight < 1;
            noMoveRounds = movedThisRound ? 0 : noMoveRounds + 1;
            if (!isHumanToBottom) {
              if (movedThisRound || atBottom || noMoveRounds >= 2) break;
              before = after;
              continue;
            }
            if (!movedThisRound && !atBottom && noMoveRounds >= 2) break;
            if (atBottom && after.scrollHeight === before?.scrollHeight) {
              stableBottomRounds += 1;
              if (stableBottomRounds >= 2) break;
            } else {
              stableBottomRounds = 0;
            }
            if (Date.now() - startedAt >= MAX_HUMAN_TO_BOTTOM_DURATION_MS) break;
            before = after;
          }

          return { result: { value: JSON.stringify({ ...after, moved }) } };
        }

        if (!isPixelScroll) {
          return sendCdp('Runtime.evaluate', {
            expression: buildScrollExpression(args),
            returnByValue: true,
            awaitPromise: true,
          });
        }

        const targetResponse = await sendCdp('Runtime.evaluate', {
          expression: buildWheelTargetExpression(args.containerSelector, args.anchorSelector),
          returnByValue: true,
          awaitPromise: true,
        });
        const targetValue = targetResponse?.result?.value;
        const target = typeof targetValue === 'string' ? JSON.parse(targetValue) : null;

        if (!target?.success) {
          return sendCdp('Runtime.evaluate', {
            expression: buildScrollExpression(args),
            returnByValue: true,
            awaitPromise: true,
          });
        }

        const humanToBottomPlan = isHumanToBottom
          ? getPixelScrollPlan({ ...args, amount: Math.abs(args.amount ?? 600), direction: 'down' })
          : getPixelScrollPlan(args);
        const humanLazyLoad = isHumanMode(args.mode) && args.humanLazyLoad === true;
        let before = target;
        let after = target;
        let moved = false;
        let stableBottomRounds = 0;
        const startedAt = Date.now();
        const maxRounds = isHumanToBottom ? MAX_HUMAN_TO_BOTTOM_ROUNDS : 1;

        for (let round = 0; round < maxRounds; round++) {
          let previousEased = 0;

          // ponytail: settle once per paced round; per-step observers can exceed the MCP request budget.
          if (humanLazyLoad) {
            await sendCdp('Runtime.evaluate', {
              expression: buildHumanLazyLoadStartExpression(
                args.containerSelector,
                args.anchorSelector,
                false,
                args.frameSelector,
              ),
              returnByValue: true,
              awaitPromise: false,
            });
          }

          // ponytail: fixed cubic ease-out; use device-specific curves only if realism needs tuning.
          for (let i = 0; i < humanToBottomPlan.steps; i++) {
            const progress = (i + 1) / humanToBottomPlan.steps;
            const eased = 1 - (1 - progress) ** 3;
            const factor = eased - previousEased;
            await sendCdp('Input.dispatchMouseEvent', {
              type: 'mouseWheel',
              x: target.x,
              y: target.y,
              deltaX: humanToBottomPlan.deltaX * factor,
              deltaY: humanToBottomPlan.deltaY * factor,
            });
            previousEased = eased;
            if (i < humanToBottomPlan.steps - 1 && humanToBottomPlan.intervalMs > 0) {
              await waitForScrollInterval(humanToBottomPlan.intervalMs, signal);
            }
          }

          if (humanLazyLoad) {
            await sendCdp('Runtime.evaluate', {
              expression: buildHumanLazyLoadWaitExpression(args.frameSelector),
              returnByValue: true,
              awaitPromise: true,
            });
          }

          const afterResponse = await sendCdp('Runtime.evaluate', {
            expression: buildScrollMeasurementExpression(
              args.containerSelector,
              args.anchorSelector,
              false,
              args.frameSelector,
            ),
            returnByValue: true,
            awaitPromise: true,
          });
          const afterValue = afterResponse?.result?.value;
          after = typeof afterValue === 'string' ? JSON.parse(afterValue) : null;
          if (!after?.success) {
            return sendCdp('Runtime.evaluate', {
              expression: buildScrollExpression(args),
              returnByValue: true,
              awaitPromise: true,
            });
          }

          moved ||=
            before?.scrollTop !== after.scrollTop || before?.scrollLeft !== after.scrollLeft;
          if (!isHumanToBottom) break;

          const atBottom = after.scrollHeight - after.scrollTop - after.clientHeight < 1;
          const movedThisRound =
            before?.scrollTop !== after.scrollTop || before?.scrollLeft !== after.scrollLeft;
          if (!movedThisRound && !atBottom) break;
          if (atBottom && after.scrollHeight === before.scrollHeight) {
            stableBottomRounds += 1;
            if (stableBottomRounds >= 2) break;
          } else {
            stableBottomRounds = 0;
          }
          if (Date.now() - startedAt >= MAX_HUMAN_TO_BOTTOM_DURATION_MS) break;
          before = after;
        }

        if (!isHumanToBottom && !moved) {
          return sendCdp('Runtime.evaluate', {
            expression: buildScrollExpression(args),
            returnByValue: true,
            awaitPromise: true,
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
        if (result.code === 'BACKGROUND_LAYOUT_UNAVAILABLE') return createErrorResponse(rawValue);
        return createErrorResponse(`Scroll failed: ${result.error}`);
      }

      // 4. Return scroll state
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...(background ? { success: true } : {}),
              target: result.target,
              moved: result.moved,
              scrollTop: result.scrollTop,
              scrollHeight: result.scrollHeight,
              clientHeight: result.clientHeight,
              scrollLeft: result.scrollLeft,
              scrollWidth: result.scrollWidth,
              clientWidth: result.clientWidth,
              ...(background ? { execution: 'dom-background', background: true } : {}),
              atBottom: result.scrollHeight - result.scrollTop - result.clientHeight < 1,
              atTop: result.scrollTop <= 0,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      const cdpError = formatScrollCdpError(error);
      if (cdpError) return createErrorResponse(cdpError);
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Scroll failed: ${message}`);
    }
  }
}

export const scrollTool = new ScrollTool();

class ScrollStateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_SCROLL_STATE;

  async execute(args: ScrollStateToolParams, signal?: AbortSignal): Promise<ToolResult> {
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

      const background = await resolveBackgroundMode(tab.id, args.background);
      const response = await cdpSessionManager.withSession(tab.id, CDP_SESSION_KEY, async () => {
        const evaluate = () =>
          cdpSessionManager.sendCommand(
            tab.id!,
            'Runtime.evaluate',
            {
              expression: buildScrollStateExpression(args, background),
              returnByValue: true,
              awaitPromise: true,
            },
            { timeoutMs: DEFAULT_TIMEOUT_MS, signal },
          );
        if (background)
          await ensureTabRendering(tab.id!, { timeoutMs: DEFAULT_TIMEOUT_MS, signal });
        let stateResponse = await evaluate();
        if (background && isZeroBackgroundLayout(parseRuntimeValue(stateResponse))) {
          await waitForScrollInterval(BACKGROUND_LAYOUT_RETRY_WAIT_MS, signal);
          await ensureTabRendering(tab.id!, { timeoutMs: DEFAULT_TIMEOUT_MS, signal });
          stateResponse = await evaluate();
        }
        return stateResponse;
      });
      if (response?.exceptionDetails) {
        return createErrorResponse(
          `Get scroll state failed: ${response.exceptionDetails.text || 'execution failed'}`,
        );
      }
      if (typeof response?.result?.value !== 'string') {
        return createErrorResponse('Get scroll state returned unexpected result');
      }

      const result = JSON.parse(response.result.value);
      if (background && isZeroBackgroundLayout(result)) {
        return createErrorResponse(
          JSON.stringify({
            success: false,
            code: 'BACKGROUND_LAYOUT_UNAVAILABLE',
            retryable: true,
            scrollHeight: result.scrollHeight || 0,
            clientHeight: result.clientHeight || 0,
            visibilityState: result.visibilityState || 'hidden',
          }),
        );
      }
      if (!result.success) return createErrorResponse(`Get scroll state failed: ${result.error}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              ...(background ? { execution: 'dom-background', background: true } : {}),
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Get scroll state failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const scrollStateTool = new ScrollStateTool();
