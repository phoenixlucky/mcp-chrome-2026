import { type ToolProgressReporter, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { ensureTabRendering, resolveBackgroundMode } from './common';
import { scrollTool } from './scroll';

const CDP_TIMEOUT_MS = 10_000;
const LAYOUT_RETRY_WAIT_MS = 400;
const result = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  isError,
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, number));
};

type SelectAllItemsArgs = {
  cardSelector: string;
  checkboxSelector: string;
  containerSelector?: string;
  step?: number;
  settleMs?: number;
  stableRounds?: number;
  maxRounds?: number;
  maxDurationMs?: number;
  restoreScroll?: boolean;
  tabId?: number;
  windowId?: number;
  background?: boolean;
};

class SelectAllItemsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SELECT_ALL_ITEMS;

  async execute(
    args: SelectAllItemsArgs,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult> {
    if (!args?.cardSelector || !args?.checkboxSelector)
      return result(
        { success: false, reason: 'cardSelector and checkboxSelector are required' },
        true,
      );
    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : null) ||
      (await this.getActiveTabInWindow(args.windowId));
    if (!tab?.id) return result({ success: false, reason: 'target_tab_not_found' }, true);

    const tabId = tab.id;
    const step = clamp(args.step, 500, 50, 5_000);
    const settleMs = clamp(args.settleMs, 500, 50, 10_000);
    const stableRounds = clamp(args.stableRounds, 3, 2, 10);
    const maxRounds = clamp(args.maxRounds, 200, 1, 1_000);
    const maxDurationMs = clamp(args.maxDurationMs, 120_000, 1_000, 600_000);

    try {
      const background = await resolveBackgroundMode(tabId, args.background);
      if (background) await ensureTabRendering(tabId, { signal });
      const evaluate = async (expression: string) => {
        const response = await cdpSessionManager.withSession(tabId, 'select-all-items', () =>
          cdpSessionManager.sendCommand(
            tabId,
            'Runtime.evaluate',
            { expression, returnByValue: true, awaitPromise: true },
            { timeoutMs: CDP_TIMEOUT_MS, signal },
          ),
        );
        if (response?.exceptionDetails)
          throw new Error(response.exceptionDetails.text || 'page_evaluation_failed');
        return response?.result?.value as Record<string, any>;
      };
      const snapshot = () => evaluate(this.buildSnapshotExpression(args));
      let current = await snapshot();
      if (!current || current.success === false) {
        return result({ success: false, reason: current?.error || 'scroll_state_failed' }, true);
      }
      if (
        background &&
        current?.top === 0 &&
        current.scrollHeight === 0 &&
        current.clientHeight === 0
      ) {
        await sleep(LAYOUT_RETRY_WAIT_MS);
        await ensureTabRendering(tabId, { signal });
        current = await snapshot();
        if (current?.top === 0 && current.scrollHeight === 0 && current.clientHeight === 0)
          return result(
            {
              success: false,
              code: 'BACKGROUND_LAYOUT_UNAVAILABLE',
              retryable: true,
              scrollHeight: 0,
              clientHeight: 0,
              visibilityState: current.visibilityState || 'hidden',
            },
            true,
          );
      }

      const originalTop = current?.top || 0;
      let stable = 0;
      let previousSignature = '';
      let rounds = 0;
      const startedAt = Date.now();
      while (rounds < maxRounds && Date.now() - startedAt < maxDurationMs) {
        if (signal?.aborted) return result({ success: false, reason: 'cancelled' }, true);
        current = await snapshot();
        if (!current || current.success === false) {
          return result({ success: false, reason: current?.error || 'scroll_state_failed' }, true);
        }
        const signature = JSON.stringify([current.cardCount, current.scrollHeight, current.sample]);
        if (current.max - current.top <= 2) {
          stable = signature === previousSignature ? stable + 1 : 1;
          if (stable >= stableRounds) break;
        } else {
          stable = 0;
        }
        previousSignature = signature;
        const scrollResult = await scrollTool.execute(
          {
            tabId,
            amount: step,
            direction: 'down',
            containerSelector: args.containerSelector,
            background: args.background !== false,
          },
          signal,
        );
        if (scrollResult.isError) return result({ success: false, reason: 'scroll_failed' }, true);
        rounds += 1;
        await sleep(settleMs);
        await reportProgress?.({ phase: 'select_all_items', rounds, ...current });
      }

      current = await snapshot();
      if (args.restoreScroll) {
        await evaluate(
          `(() => { const c = ${args.containerSelector ? `document.querySelector(${JSON.stringify(args.containerSelector)})` : 'document.scrollingElement || document.documentElement'}; if (c) c.scrollTop = Math.min(${JSON.stringify(originalTop)}, Math.max(0, c.scrollHeight - c.clientHeight)); return true; })()`,
        );
      }
      const atBottom = current.max - current.top <= 2;
      const success = atBottom && stable >= stableRounds;
      return result(
        {
          success,
          listStable: stable >= stableRounds,
          atBottom,
          rounds,
          stableRounds: stable,
          background,
          ...current,
          renderedCardCount: current.cardCount,
          renderedCheckboxCount: current.checkboxCount,
          selectedRenderedCount: current.selectedCount,
          message:
            '已滚动到列表底部并逐个勾选当前已渲染的卡片；返回数量是 DOM 当前实际确认到的数量。',
        },
        !success,
      );
    } catch (error) {
      if (signal?.aborted) return result({ success: false, reason: 'cancelled' }, true);
      return result(
        { success: false, reason: error instanceof Error ? error.message : 'failed' },
        true,
      );
    }
  }

  private buildSnapshotExpression(args: SelectAllItemsArgs): string {
    const cardSelector = JSON.stringify(args.cardSelector);
    const checkboxSelector = JSON.stringify(args.checkboxSelector);
    const container = args.containerSelector
      ? `document.querySelector(${JSON.stringify(args.containerSelector)})`
      : 'document.scrollingElement || document.documentElement';
    return `(() => {
      const scrollTarget = ${container};
      const cards = Array.from(document.querySelectorAll(${cardSelector}));
      const checked = box => box instanceof HTMLInputElement ? box.checked : box.getAttribute('aria-checked') === 'true';
      const disabled = box => box.disabled === true || box.getAttribute?.('aria-disabled') === 'true';
      const setChecked = box => {
        if (!box || disabled(box) || checked(box)) return checked(box);
        try { box.click(); } catch {}
        if (!checked(box) && box instanceof HTMLInputElement) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
          setter?.call(box, true);
          box.dispatchEvent(new Event('input', { bubbles: true }));
          box.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return checked(box);
      };
      let checkboxCount = 0, selectedCount = 0, disabledCount = 0;
      for (const card of cards) {
        let boxes = [];
        if (card.matches?.(${checkboxSelector})) boxes = [card];
        else try { boxes = Array.from(card.querySelectorAll(${checkboxSelector})); } catch {}
        for (const box of boxes) {
          checkboxCount++;
          if (disabled(box)) { disabledCount++; continue; }
          if (setChecked(box)) selectedCount++;
        }
      }
      const top = scrollTarget?.scrollTop || 0;
      const scrollHeight = scrollTarget?.scrollHeight || 0;
      const clientHeight = scrollTarget?.clientHeight || 0;
      return {
        success: true,
        cardCount: cards.length,
        checkboxCount,
        selectedCount,
        disabledCount,
        top,
        max: Math.max(0, scrollHeight - clientHeight),
        scrollHeight,
        clientHeight,
        sample: cards.slice(-3).map(card => (card.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)),
        visibilityState: document.visibilityState,
      };
    })()`;
  }
}

export const selectAllItemsTool = new SelectAllItemsTool();
