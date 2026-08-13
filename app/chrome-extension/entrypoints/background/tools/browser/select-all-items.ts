import { type ToolProgressReporter, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

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
};

const result = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  isError,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

class SelectAllItemsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SELECT_ALL_ITEMS;

  async execute(
    args: SelectAllItemsArgs,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult> {
    if (!args?.cardSelector || !args?.checkboxSelector) {
      return result(
        {
          success: false,
          reason: 'cardSelector and checkboxSelector are required',
        },
        true,
      );
    }

    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : null) ||
      (await this.getActiveTabInWindow(args.windowId));
    if (!tab?.id) return result({ success: false, reason: 'target_tab_not_found' }, true);

    const step = clamp(args.step, 500, 50, 5_000);
    const settleMs = clamp(args.settleMs, 500, 50, 10_000);
    const stableRounds = clamp(args.stableRounds, 3, 2, 10);
    const maxRounds = clamp(args.maxRounds, 200, 1, 1_000);
    const maxDurationMs = clamp(args.maxDurationMs, 120_000, 1_000, 600_000);

    try {
      const expression = this.buildExpression({
        ...args,
        step,
        settleMs,
        stableRounds,
        maxRounds,
        maxDurationMs,
      });
      const response = await cdpSessionManager.withSession(tab.id, 'select-all-items', () =>
        cdpSessionManager.sendCommand(tab.id!, 'Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
        }),
      );
      if (response?.exceptionDetails) {
        return result(
          {
            success: false,
            reason: response.exceptionDetails.text || 'page_evaluation_failed',
          },
          true,
        );
      }

      const data = response?.result?.value || { success: false, reason: 'no_result' };
      if (reportProgress && typeof data === 'object' && data) {
        reportProgress({
          phase: 'select_all_items',
          ...(data as Record<string, unknown>),
        });
      }
      return result(data, (data as { success?: boolean })?.success === false);
    } catch (error) {
      if (signal?.aborted) return result({ success: false, reason: 'cancelled' }, true);
      return result(
        { success: false, reason: error instanceof Error ? error.message : 'failed' },
        true,
      );
    }
  }

  private buildExpression(
    args: Required<
      Pick<
        SelectAllItemsArgs,
        | 'cardSelector'
        | 'checkboxSelector'
        | 'step'
        | 'settleMs'
        | 'stableRounds'
        | 'maxRounds'
        | 'maxDurationMs'
      >
    > &
      Pick<SelectAllItemsArgs, 'containerSelector' | 'restoreScroll'>,
  ): string {
    const cardSelector = JSON.stringify(args.cardSelector);
    const checkboxSelector = JSON.stringify(args.checkboxSelector);
    const containerSelector = JSON.stringify(args.containerSelector || '');
    const options = JSON.stringify({
      step: args.step,
      settleMs: args.settleMs,
      stableRounds: args.stableRounds,
      maxRounds: args.maxRounds,
      maxDurationMs: args.maxDurationMs,
      restoreScroll: args.restoreScroll === true,
    });

    return `(async () => {
      const cardSelector = ${cardSelector};
      const checkboxSelector = ${checkboxSelector};
      const options = ${options};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const startedAt = Date.now();
      const originalWindowY = window.scrollY;
      const container = ${containerSelector} ? document.querySelector(${containerSelector}) : null;
      const scrollTarget = container || document.scrollingElement || document.documentElement;
      const originalContainerTop = container ? container.scrollTop : originalWindowY;
      const isWindowScroll = scrollTarget === document.scrollingElement || scrollTarget === document.documentElement;
      const getTop = () => isWindowScroll ? window.scrollY : scrollTarget.scrollTop;
      const getMax = () => isWindowScroll
        ? Math.max(0, Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0) - window.innerHeight)
        : Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
      const scrollTo = (top) => {
        if (isWindowScroll) window.scrollTo({ top, behavior: 'auto' });
        else scrollTarget.scrollTo({ top, behavior: 'auto' });
      };
      const queryCards = () => Array.from(document.querySelectorAll(cardSelector));
      const queryCheckboxes = (card) => {
        if (card.matches?.(checkboxSelector)) return [card];
        try { return Array.from(card.querySelectorAll(checkboxSelector)); } catch { return []; }
      };
      const isChecked = (checkbox) => checkbox instanceof HTMLInputElement
        ? checkbox.checked
        : checkbox.getAttribute('aria-checked') === 'true';
      const isDisabled = (checkbox) => checkbox.disabled === true || checkbox.getAttribute?.('aria-disabled') === 'true';
      const makeChecked = (checkbox) => {
        if (!checkbox || isDisabled(checkbox)) return false;
        if (isChecked(checkbox)) return true;
        try { checkbox.click(); } catch {}
        return isChecked(checkbox);
      };
      const forceChecked = (checkbox) => {
        if (!checkbox || isDisabled(checkbox) || isChecked(checkbox)) return isChecked(checkbox);
        if (checkbox instanceof HTMLInputElement) {
          const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
          descriptor?.set?.call(checkbox, true);
          checkbox.dispatchEvent(new Event('input', { bubbles: true }));
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
        return isChecked(checkbox);
      };
      const selectRendered = () => {
        const cards = queryCards();
        let checkboxCount = 0;
        let selectedCount = 0;
        let disabledCount = 0;
        for (const card of cards) {
          for (const checkbox of queryCheckboxes(card)) {
            checkboxCount += 1;
            if (isDisabled(checkbox)) { disabledCount += 1; continue; }
            if (!isChecked(checkbox)) makeChecked(checkbox);
            if (!isChecked(checkbox)) forceChecked(checkbox);
            if (isChecked(checkbox)) selectedCount += 1;
          }
        }
        return { cardCount: cards.length, checkboxCount, selectedCount, disabledCount };
      };
      const snapshot = () => {
        const cards = queryCards();
        const sample = cards.slice(-3).map((card) => (card.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120));
        const rendered = selectRendered();
        return {
          ...rendered,
          top: getTop(),
          max: getMax(),
          scrollHeight: scrollTarget.scrollHeight,
          sample,
        };
      };
      let current = snapshot();
      let previousListSignature = '';
      let stable = 0;
      let rounds = 0;
      while (rounds < options.maxRounds && Date.now() - startedAt < options.maxDurationMs) {
        rounds += 1;
        current = snapshot();
        const listSignature = JSON.stringify([current.cardCount, current.scrollHeight, current.sample]);
        if (current.max - current.top <= 2) {
          stable = listSignature === previousListSignature ? stable + 1 : 1;
          if (stable >= options.stableRounds) break;
        } else {
          stable = 0;
          scrollTo(Math.min(current.max, current.top + options.step));
        }
        previousListSignature = listSignature;
        await sleep(options.settleMs);
      }
      current = snapshot();
      if (options.restoreScroll) {
        if (isWindowScroll) window.scrollTo({ top: originalWindowY, behavior: 'auto' });
        else scrollTarget.scrollTo({ top: Math.min(originalContainerTop, getMax()), behavior: 'auto' });
      }
      return {
        success: current.max - current.top <= 2 && stable >= options.stableRounds,
        listStable: stable >= options.stableRounds,
        atBottom: current.max - current.top <= 2,
        rounds,
        stableRounds: stable,
        ...current,
        renderedCardCount: current.cardCount,
        renderedCheckboxCount: current.checkboxCount,
        selectedRenderedCount: current.selectedCount,
        message: '已滚动到列表底部并逐个勾选当前已渲染的卡片；返回数量是 DOM 当前实际确认到的数量。',
      };
    })()`;
  }
}

export const selectAllItemsTool = new SelectAllItemsTool();
