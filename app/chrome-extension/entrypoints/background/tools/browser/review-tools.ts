import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import {
  detectEmptyStateFromDom,
  extractReviewSummaryFromDom,
  extractRecordsFromDom,
  hashCards,
  mergeRecords,
  type Field,
} from './review-utils';

type Candidate = { selector?: string; text?: string; role?: string; type?: 'css' | 'xpath' };
type Target = { tabId?: number; windowId?: number; frameSelector?: string };
const TIMEOUT = 10_000;

function json(value: unknown, isError = false): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], isError };
}

abstract class ReviewTool extends BaseBrowserToolExecutor {
  protected async tabId(args: Target): Promise<number> {
    const tab = await this.resolveTargetTab(args.tabId, args.windowId);
    if (typeof tab.id !== 'number') throw new Error('target_tab_not_found');
    return tab.id;
  }

  protected async eval(tabId: number, expression: string): Promise<unknown> {
    const response = await cdpSessionManager.withSession(tabId, 'review-tools', () =>
      cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      }),
    );
    if (response?.exceptionDetails)
      throw new Error(response.exceptionDetails.text || 'page_evaluation_failed');
    return response?.result?.value;
  }
}

class FindAndClickTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.FIND_AND_CLICK;
  async execute(
    args: Target & {
      candidates: Candidate[];
      scopeSelector?: string;
      waitSelector?: string;
      waitFor?: string;
      waitTimeout?: number;
    },
  ): Promise<ToolResult> {
    if (!Array.isArray(args?.candidates) || args.candidates.length === 0)
      return json(
        {
          success: false,
          reason: 'invalid_candidates',
          message:
            'candidates must be a non-empty array, e.g. [{"selector":"button[type=submit]"}]',
        },
        true,
      );
    try {
      const tabId = await this.tabId(args);
      const result = await this.eval(
        tabId,
        `(() => {
        const candidates = ${JSON.stringify(args.candidates)};
        const base = ${args.frameSelector ? `document.querySelector(${JSON.stringify(args.frameSelector)})?.contentDocument` : 'document'};
        const scope = ${args.scopeSelector ? `base?.querySelector(${JSON.stringify(args.scopeSelector)})` : 'base'};
        if (!scope) return { success:false, reason:'scope_not_found', matchedCount:0 };
        const timeout = Math.min(Math.max(Number(${JSON.stringify(args.waitTimeout ?? TIMEOUT)}) || 0, 0), 30000);
        const deadline = Date.now() + timeout;
        const visible = el => {
          if (!el || !el.isConnected) return false;
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          const disabled = el.closest('[disabled],[aria-disabled="true"]');
          return !disabled && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0;
        };
        const matchesFor = c => {
          if (c.type === 'xpath' && c.selector) {
            try {
              const x = base.evaluate(c.selector, scope, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
              return x instanceof Element && scope.contains(x) ? [x] : [];
            } catch (_) { return []; }
          }
          if (c.selector) {
            try { return Array.from(scope.querySelectorAll(c.selector)); } catch (_) { return []; }
          }
          if (!c.text) return [];
          const text = String(c.text).trim().toLowerCase();
          const pool = Array.from(scope.querySelectorAll(c.role ? '[role]' : '*')).filter(
            (x) =>
              (!c.role || x.getAttribute('role') === c.role) &&
              (x.textContent || '').trim().toLowerCase().includes(text),
          );
          const actionable = pool.filter(
            (x) =>
              /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(x.tagName) ||
              x.getAttribute('role') === 'button' ||
              x.hasAttribute('tabindex'),
          );
          return actionable.length ? actionable : pool;
        };
        let matchedCount = 0;
        do {
          for (let i = 0; i < candidates.length; i++) {
            const matches = matchesFor(candidates[i]);
            matchedCount += matches.length;
            const el = matches.find(visible);
            if (el) {
              el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
              el.click();
              return { success:true, clicked:true, matchedCandidate:i, selector:candidates[i].selector || 'text=' + candidates[i].text, matchedCount };
            }
          }
          if (Date.now() >= deadline) break;
          await new Promise(resolve => setTimeout(resolve, 150));
        } while (true);
        return { success:false, reason:'not_found', matchedCount };
      })()`,
      );
      if (!(result as any)?.success || !args.waitSelector)
        return json(result, !(result as any)?.success);
      const wait = await this.wait(
        tabId,
        args.waitSelector,
        args.waitTimeout || TIMEOUT,
        args.frameSelector,
      );
      return json({ ...(result as object), waitResult: wait, success: wait.found });
    } catch (error) {
      return json(
        { success: false, reason: error instanceof Error ? error.message : 'failed' },
        true,
      );
    }
  }
  private async wait(tabId: number, selector: string, timeout: number, frameSelector?: string) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const found = await this.eval(
        tabId,
        `${frameSelector ? `document.querySelector(${JSON.stringify(frameSelector)})?.contentDocument` : 'document'}?.querySelector(${JSON.stringify(selector)}) !== null`,
      );
      if (found) return { found: true, elapsedMs: Date.now() - started };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { found: false, reason: 'timeout', elapsedMs: Date.now() - started };
  }
}

class ExtractRecordsTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.EXTRACT_RECORDS;
  async execute(
    args: Target & {
      cardSelector: string;
      fields: Field[];
      excludeIfTextMatches?: string[];
      includeOuterHtml?: boolean;
    },
  ): Promise<ToolResult> {
    if (!args.cardSelector || !args.fields)
      return json({ success: false, reason: 'invalid_parameters' }, true);
    try {
      const tabId = await this.tabId(args);
      const root = args.frameSelector
        ? `document.querySelector(${JSON.stringify(args.frameSelector)})?.contentDocument`
        : 'document';
      const output = await this.eval(
        tabId,
        `(${extractRecordsFromDom.toString()})(${root}, ${JSON.stringify(args.cardSelector)}, ${JSON.stringify(args.fields)}, ${JSON.stringify(args.excludeIfTextMatches || [])}, ${args.includeOuterHtml === true})`,
      );
      return json({
        success: true,
        ...(output as object),
        matchedCount: (output as any)?.records?.length || 0,
      });
    } catch (error) {
      return json(
        { success: false, reason: error instanceof Error ? error.message : 'failed', records: [] },
        true,
      );
    }
  }
}

class DetectEmptyStateTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.DETECT_EMPTY_STATE;
  async execute(
    args: Target & { contentSelector: string; emptyTextMarkers?: string[]; countSelector?: string },
  ): Promise<ToolResult> {
    try {
      const tabId = await this.tabId(args);
      const root = args.frameSelector
        ? `document.querySelector(${JSON.stringify(args.frameSelector)})?.contentDocument`
        : 'document';
      const output = await this.eval(
        tabId,
        `(${detectEmptyStateFromDom.toString()})(${root}, ${JSON.stringify(args.contentSelector)}, ${JSON.stringify(args.emptyTextMarkers || [])}, ${JSON.stringify(args.countSelector)})`,
      );
      return json({ success: true, ...(output as object) });
    } catch (error) {
      return json(
        {
          success: false,
          state: 'loading_or_unknown',
          reason: error instanceof Error ? error.message : 'failed',
        },
        true,
      );
    }
  }
}

class ExtractReviewSummaryTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.EXTRACT_REVIEW_SUMMARY;

  async execute(args: Target): Promise<ToolResult> {
    try {
      const tabId = await this.tabId(args);
      const root = args.frameSelector
        ? `document.querySelector(${JSON.stringify(args.frameSelector)})?.contentDocument`
        : 'document';
      const output = await this.eval(
        tabId,
        `(${extractReviewSummaryFromDom.toString()})(${root}, location.href)`,
      );
      return json({ success: true, ...(output as object) });
    } catch (error) {
      return json(
        {
          success: false,
          found: false,
          state: 'loading_or_unknown',
          reason: error instanceof Error ? error.message : 'failed',
        },
        true,
      );
    }
  }
}

class MergeRecordsTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.MERGE_RECORDS;
  async execute(args: {
    sources: Array<{ name: string; priority: number; records: Record<string, unknown>[] }>;
    identityFields: string[];
    fieldPriority?: Record<string, string[]>;
    allowSourceOnlyRecords?: boolean;
    textNormalize?: boolean;
    dateToleranceDays?: number;
  }): Promise<ToolResult> {
    if (!args?.sources || !args.identityFields?.length)
      return json({ success: false, reason: 'invalid_parameters' }, true);
    return json({
      success: true,
      ...mergeRecords(
        args.sources,
        args.identityFields,
        args.fieldPriority,
        args.allowSourceOnlyRecords,
        args.textNormalize,
        args.dateToleranceDays,
      ),
    });
  }
}

class ExpandSectionTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.EXPAND_SECTION;
  async execute(
    args: Target & {
      trigger: { candidates: Candidate[]; scopeSelector?: string };
      expandedAttribute?: string;
      contentSelector: string;
      waitTimeout?: number;
    },
  ): Promise<ToolResult> {
    try {
      const tabId = await this.tabId(args);
      const attribute = args.expandedAttribute || 'aria-expanded';
      const expanded = await this.eval(
        tabId,
        `(() => { const root=${args.trigger.scopeSelector ? `document.querySelector(${JSON.stringify(args.trigger.scopeSelector)})` : 'document'}; const c=${JSON.stringify(args.trigger.candidates)}; for(const x of c){const e=x.selector?root?.querySelector(x.selector):null;if(e)return e.getAttribute(${JSON.stringify(attribute)})==='true';} return false; })()`,
      );
      if (expanded)
        return json({
          success: true,
          alreadyExpanded: true,
          clicked: false,
          contentFound: true,
          changed: false,
        });
      const click = await findAndClickTool.execute({
        ...args,
        ...args.trigger,
        waitSelector: args.contentSelector,
        waitTimeout: args.waitTimeout,
      });
      const payload = JSON.parse((click.content[0] as any).text);
      if (payload.success)
        return json({
          success: true,
          alreadyExpanded: false,
          clicked: true,
          contentFound: true,
          changed: true,
        });
      const retry = await findAndClickTool.execute({
        ...args,
        ...args.trigger,
        waitSelector: args.contentSelector,
        waitTimeout: args.waitTimeout,
      });
      const retryPayload = JSON.parse((retry.content[0] as any).text);
      return json(
        {
          success: retryPayload.success,
          alreadyExpanded: false,
          clicked: Boolean(retryPayload.clicked),
          contentFound: Boolean(retryPayload.waitResult?.found),
          changed: Boolean(retryPayload.waitResult?.found),
          reason: retryPayload.reason,
        },
        !retryPayload.success,
      );
    } catch (error) {
      return json(
        { success: false, reason: error instanceof Error ? error.message : 'failed' },
        true,
      );
    }
  }
}

class ScanForSectionTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.SCAN_FOR_SECTION;
  async execute(
    args: Target & {
      targetSelector: string;
      stopSelector?: string;
      direction?: 'down' | 'up';
      step?: number;
      maxSteps?: number;
      rescanUpSteps?: number;
      waitAfterScrollMs?: number;
    },
  ): Promise<ToolResult> {
    try {
      const tabId = await this.tabId(args);
      const step = Math.max(1, args.step || 900);
      const max = Math.max(1, args.maxSteps || 12);
      const root = args.frameSelector
        ? `document.querySelector(${JSON.stringify(args.frameSelector)})?.contentDocument`
        : 'document';
      const direction = args.direction || 'down';
      const waitMs = Math.min(Math.max(args.waitAfterScrollMs || 800, 100), 5_000);
      const check = () =>
        this.eval(
          tabId,
          `(() => { const root=${root}; const win=root?.defaultView || window; const scrollHeight=root?.documentElement?.scrollHeight || 0; const top=win.scrollY; return { found: root?.querySelector(${JSON.stringify(args.targetSelector)}) !== null, stopped: ${args.stopSelector ? `root?.querySelector(${JSON.stringify(args.stopSelector)}) !== null` : 'false'}, atTop: top <= 1, atBottom: win.innerHeight + top >= scrollHeight - 1, scrollHeight, top }; })()`,
        ) as Promise<any>;
      let lastHeight = 0;
      let edgeWaits = 0;
      for (let i = 0; i < max; i += 1) {
        const state = await check();
        if (state.found)
          return json({
            success: true,
            found: true,
            phase: direction,
            steps: i,
            atBottom: state.atBottom,
            changed: i > 0,
          });
        const atEdge = direction === 'up' ? state.atTop : state.atBottom;
        if (state.stopped) break;
        if (atEdge) {
          if (state.scrollHeight !== lastHeight) {
            lastHeight = state.scrollHeight;
            edgeWaits = 0;
          } else if (edgeWaits < 6) {
            edgeWaits += 1;
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          } else {
            break;
          }
        } else {
          edgeWaits = 0;
          lastHeight = state.scrollHeight;
        }
        await this.eval(
          tabId,
          `(${root}.defaultView || window).scrollBy(0, ${direction === 'up' ? -step : step})`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      for (let i = 0; i < (args.rescanUpSteps || 0); i += 1) {
        await this.eval(tabId, `(${root}.defaultView || window).scrollBy(0, ${-step})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        const state = await check();
        if (state.found)
          return json({
            success: true,
            found: true,
            phase: 'rescan_up',
            steps: i + 1,
            atBottom: state.atBottom,
            changed: true,
          });
      }
      const state = await check();
      return json({
        success: false,
        found: false,
        reason: state.stopped
          ? 'stop_selector'
          : direction === 'up' && state.atTop
            ? 'top'
            : state.atBottom
              ? 'bottom'
              : 'max_steps',
        phase: direction,
        steps: max,
        atBottom: state.atBottom,
        changed: false,
      });
    } catch (error) {
      return json(
        { success: false, found: false, reason: error instanceof Error ? error.message : 'failed' },
        true,
      );
    }
  }
}

class PaginateExtractTool extends ReviewTool {
  name = TOOL_NAMES.BROWSER.PAGINATE_EXTRACT;
  async execute(
    args: Target & {
      cardSelector: string;
      next: { candidates: Candidate[]; scopeSelector?: string };
      fields: Field[];
      expectedCount?: number;
      maxPages?: number;
      waitTimeout?: number;
    },
  ): Promise<ToolResult> {
    if (!args.cardSelector || !args.next?.candidates?.length || !args.fields)
      return json({ success: false, reason: 'invalid_parameters' }, true);
    try {
      const tabId = await this.tabId(args);
      const pages: unknown[] = [];
      let collectedCount = 0;
      const maxPages = Math.max(1, Math.min(args.maxPages || 100, 200));
      const root = args.frameSelector
        ? `document.querySelector(${JSON.stringify(args.frameSelector)})?.contentDocument`
        : 'document';
      for (let page = 1; page <= maxPages; page += 1) {
        const extracted = await extractRecordsTool.execute({
          ...args,
          cardSelector: args.cardSelector,
          fields: args.fields,
        });
        const data = JSON.parse((extracted.content[0] as any).text);
        const items = data.records || [];
        pages.push({ page, items, count: items.length });
        collectedCount += items.length;
        if (args.expectedCount !== undefined && collectedCount >= args.expectedCount)
          return json({
            success: true,
            stopReason: 'expected_count_reached',
            pages,
            collectedCount,
            changed: page > 1,
          });
        const before = await this.eval(
          tabId,
          `(${hashCards.toString()})(${root}, ${JSON.stringify(args.cardSelector)})`,
        );
        const click = await findAndClickTool.execute({ ...args, ...args.next });
        const clicked = JSON.parse((click.content[0] as any).text);
        if (!clicked.success)
          return json({
            success: true,
            stopReason: page === 1 ? 'no_next' : 'last_page',
            pages,
            collectedCount,
            changed: page > 1,
          });
        const timeout = args.waitTimeout || TIMEOUT;
        const started = Date.now();
        let changed = false;
        while (Date.now() - started < timeout) {
          const after = await this.eval(
            tabId,
            `(${hashCards.toString()})(${root}, ${JSON.stringify(args.cardSelector)})`,
          );
          if (after !== before) {
            changed = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!changed) {
          const retry = await findAndClickTool.execute({ ...args, ...args.next });
          if (!JSON.parse((retry.content[0] as any).text).success)
            return json({
              success: true,
              stopReason: 'content_unchanged',
              pages,
              collectedCount,
              changed: false,
            });
        }
        const afterRetry = await this.eval(
          tabId,
          `(${hashCards.toString()})(${root}, ${JSON.stringify(args.cardSelector)})`,
        );
        if (afterRetry === before)
          return json({
            success: true,
            stopReason: 'content_unchanged',
            pages,
            collectedCount,
            changed: false,
          });
      }
      return json({
        success: true,
        stopReason: 'max_pages',
        pages,
        collectedCount,
        changed: pages.length > 1,
      });
    } catch (error) {
      return json(
        {
          success: false,
          stopReason: 'timeout',
          pages: [],
          collectedCount: 0,
          reason: error instanceof Error ? error.message : 'failed',
        },
        true,
      );
    }
  }
}

export const findAndClickTool = new FindAndClickTool();
export const extractRecordsTool = new ExtractRecordsTool();
export const detectEmptyStateTool = new DetectEmptyStateTool();
export const extractReviewSummaryTool = new ExtractReviewSummaryTool();
export const mergeRecordsTool = new MergeRecordsTool();
export const expandSectionTool = new ExpandSectionTool();
export const scanForSectionTool = new ScanForSectionTool();
export const paginateExtractTool = new PaginateExtractTool();
