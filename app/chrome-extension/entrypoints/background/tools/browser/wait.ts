/**
 * Wait Tool - chrome_wait
 *
 * Wait for a DOM element or JavaScript condition to become true.
 * Polls the page at a configurable interval until the condition is met
 * or the timeout expires. Returns { found: true/false } instead of
 * throwing on timeout, so the caller can decide how to proceed.
 *
 * Supports 6 wait modes:
 * - visible (default): element exists AND has offsetParent !== null
 * - present: element exists in DOM
 * - hidden: element exists but is hidden (offsetParent === null)
 * - gone: element does NOT exist in DOM
 * - enabled: element exists, visible, and not disabled
 * - jsCondition: custom JS expression returning boolean
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 200;
const MAX_TIMEOUT_MS = 120_000;
const MIN_POLL_INTERVAL_MS = 50;
const CDP_SESSION_KEY = 'wait';

// ============================================================================
// Types
// ============================================================================

type WaitMode = 'visible' | 'present' | 'hidden' | 'gone' | 'enabled';

interface WaitToolParams {
  selector?: string;
  waitFor?: WaitMode;
  jsCondition?: string;
  timeout?: number;
  pollInterval?: number;
  tabId?: number;
  windowId?: number;
}

// ============================================================================
// Build Wait Condition JS
// ============================================================================

function buildConditionExpression(params: WaitToolParams): string {
  const { selector, waitFor = 'visible', jsCondition } = params;

  if (jsCondition) {
    // Custom JS condition — evaluate as-is, coerce to boolean
    return `((${jsCondition}) === true)`;
  }

  if (!selector) {
    // No selector and no jsCondition → always true (edge case)
    return 'true';
  }

  const escapedSelector = JSON.stringify(selector);

  switch (waitFor) {
    case 'present':
      return `(document.querySelector(${escapedSelector}) !== null)`;
    case 'visible':
      return `(() => {
        const el = document.querySelector(${escapedSelector});
        if (!el) return false;
        if (el.offsetParent === null) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        return true;
      })()`;
    case 'hidden':
      return `(() => {
        const el = document.querySelector(${escapedSelector});
        if (!el) return false;
        return (el.offsetParent === null || window.getComputedStyle(el).display === 'none');
      })()`;
    case 'gone':
      return `(document.querySelector(${escapedSelector}) === null)`;
    case 'enabled':
      return `(() => {
        const el = document.querySelector(${escapedSelector});
        if (!el) return false;
        if (el.offsetParent === null) return false;
        if (el.disabled === true) return false;
        if (el.getAttribute('aria-disabled') === 'true') return false;
        return true;
      })()`;
    default:
      return 'false';
  }
}

// ============================================================================
// Tool Implementation
// ============================================================================

class WaitTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.WAIT;

  async execute(args: WaitToolParams): Promise<ToolResult> {
    const timeout = Math.min(
      typeof args.timeout === 'number' ? args.timeout : DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );
    const pollInterval = Math.max(
      typeof args.pollInterval === 'number' ? args.pollInterval : DEFAULT_POLL_INTERVAL_MS,
      MIN_POLL_INTERVAL_MS,
    );

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

      // 2. Build condition expression
      const conditionExpr = buildConditionExpression(args);

      // 3. Validate: at least one of selector or jsCondition must be provided
      if (!args.selector && !args.jsCondition) {
        return createErrorResponse('Either "selector" or "jsCondition" must be provided');
      }

      // 4. Poll loop
      const startedAt = Date.now();
      let lastError: string | null = null;

      while (Date.now() - startedAt < timeout) {
        const elapsed = Date.now() - startedAt;
        const remaining = timeout - elapsed;

        const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
          return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
            expression: `(() => { try { return ${conditionExpr}; } catch(e) { return '__ERROR__:' + (e.message || String(e)); } })()`,
            returnByValue: true,
            awaitPromise: true,
            timeout: Math.min(remaining, 5000),
          });
        });

        if (response?.exceptionDetails) {
          lastError = response.exceptionDetails.text || 'Unknown evaluation error';
          // Wait before retry
          await this.sleep(pollInterval);
          continue;
        }

        const value = response?.result?.value;

        if (typeof value === 'string' && value.startsWith('__ERROR__:')) {
          lastError = value.slice(9);
          await this.sleep(pollInterval);
          continue;
        }

        if (value === true) {
          // Condition met
          const metadata = await this.getMatchMetadata(tabId, args.selector);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  found: true,
                  elapsedMs: Date.now() - startedAt,
                  ...metadata,
                }),
              },
            ],
            isError: false,
          };
        }

        // Wait for next poll
        const timeRemaining = timeout - (Date.now() - startedAt);
        if (timeRemaining <= 0) break;

        await this.sleep(Math.min(pollInterval, timeRemaining));
      }

      // 5. Timeout — condition not met
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              found: false,
              elapsedMs: Date.now() - startedAt,
              timeout,
              lastError,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Wait failed: ${message}`);
    }
  }

  /**
   * Get metadata about the matched element for the response.
   */
  private async getMatchMetadata(
    tabId: number,
    selector?: string,
  ): Promise<Record<string, unknown>> {
    if (!selector) return {};

    try {
      const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
        return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression: `(() => {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return JSON.stringify({ count: 0 });
              const rect = el.getBoundingClientRect();
              const tag = el.tagName ? el.tagName.toLowerCase() : '';
              const id = el.id || '';
              const cls = Array.from(el.classList || []).join('.');
              return JSON.stringify({
                count: document.querySelectorAll(${JSON.stringify(selector)}).length,
                tag,
                id: cls ? tag + '#' + id + '.' + cls : tag + '#' + id,
                visible: el.offsetParent !== null,
                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
              });
            })()`,
          returnByValue: true,
          awaitPromise: true,
          timeout: 2000,
        });
      });

      if (response?.result?.value && typeof response.result.value === 'string') {
        return JSON.parse(response.result.value);
      }
    } catch {
      // Best-effort metadata
    }

    return {};
  }

  /**
   * Promise-based sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const waitTool = new WaitTool();
