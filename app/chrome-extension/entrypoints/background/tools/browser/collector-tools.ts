import { type ToolProgressReporter, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { diagnosticSnapshotTool } from './diagnostic-snapshot';
import { networkDebuggerStartTool, networkDebuggerStopTool } from './network-capture-debugger';
import { findAndClickTool } from './review-tools';
import { extractRecordsFromDom, type Field } from './review-utils';
import { extractJsonRecords } from './collector-utils';
import { buildScrollContainerExpression } from './scroll';

type Target = { tabId?: number; windowId?: number; frameSelector?: string };
type Candidate = { selector?: string; text?: string; role?: string; type?: 'css' | 'xpath' };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const result = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  isError,
});

type CollectionScroll = {
  step?: number;
  waitMs?: number;
  waitTimeoutMs?: number;
  settleMs?: number;
  stalledLimit?: number;
  rescanUp?: boolean;
  containerSelector?: string;
  anchorSelector?: string;
};

type CollectionStopWhen = {
  type: 'textMatch' | 'selector' | 'stable' | 'networkIdle' | 'networkComplete' | 'jsCondition';
  pattern?: string;
  selector?: string;
  urlPattern?: string;
  condition?: string;
  stableRounds?: number;
};

type CollectionState = {
  seenIds?: string[];
  scrollY?: number;
  pageUrl?: string;
  containerTarget?: string;
};

type CollectionArgs = Target & {
  cardSelector: string;
  fields: Field[];
  identityFields: string[];
  maxItems?: number;
  maxDurationMs?: number;
  returnBatches?: boolean;
  batchSize?: number;
  returnProgress?: boolean;
  progressEverySteps?: number;
  containerSelector?: string;
  anchorSelector?: string;
  scroll?: CollectionScroll;
  stopWhen?: CollectionStopWhen;
  state?: CollectionState;
};

type ScrollSnapshot = {
  top: number;
  max: number;
  atTop: boolean;
  atBottom: boolean;
  scrollHeight: number;
  clientHeight: number;
  cardCount: number;
  cardSample: string;
  busy: boolean;
  target: string;
};

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeIdentityPart(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function identityKey(record: Record<string, unknown>, fields: string[]): string {
  const parts = fields.map((field) => normalizeIdentityPart(record[field]));
  if (parts.some(Boolean)) return JSON.stringify(parts);
  return `record:${JSON.stringify(record)}`;
}

function parseResult(result: ToolResult): Record<string, any> {
  const text = result.content.find((item) => item.type === 'text') as { text?: string } | undefined;
  if (!text?.text) return {};
  try {
    return JSON.parse(text.text);
  } catch {
    return { success: !result.isError, raw: text.text };
  }
}

function framePrelude(frameSelector?: string): string {
  return frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';
}

function collectionContainerSelector(args: CollectionArgs): string | undefined {
  return args.containerSelector || args.scroll?.containerSelector;
}

function collectionAnchorSelector(args: CollectionArgs): string | undefined {
  return args.anchorSelector || args.scroll?.anchorSelector;
}

abstract class CollectorTool extends BaseBrowserToolExecutor {
  protected async resolveTab(args: Target): Promise<chrome.tabs.Tab> {
    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : null) ||
      (await this.getActiveTabInWindow(args.windowId));
    if (!tab?.id) throw new Error('target_tab_not_found');
    return tab;
  }

  protected async evaluate(tabId: number, expression: string): Promise<unknown> {
    const response = await cdpSessionManager.withSession(tabId, 'collector-tools', () =>
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

class CollectVirtualListTool extends CollectorTool {
  name = TOOL_NAMES.BROWSER.COLLECT_VIRTUAL_LIST;

  async execute(
    args: CollectionArgs,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult> {
    if (!args.cardSelector || !args.fields?.length || !args.identityFields?.length)
      return result({ success: false, reason: 'invalid_parameters', items: [] }, true);
    const partialItems: Record<string, unknown>[] = [];
    try {
      const tab = await this.resolveTab(args);
      const tabId = tab.id!;
      const root = 'doc';
      const maxItems = clampInteger(args.maxItems, 100, 1, 10_000);
      const maxDurationMs = clampInteger(args.maxDurationMs, 120_000, 1_000, 600_000);
      const step = clampInteger(args.scroll?.step, 300, 1, 5_000);
      const waitMs = clampInteger(args.scroll?.waitMs, 800, 50, 10_000);
      const waitTimeoutMs = clampInteger(
        args.scroll?.waitTimeoutMs,
        Math.max(waitMs, 2_000),
        waitMs,
        15_000,
      );
      const settleMs = clampInteger(args.scroll?.settleMs, 200, 50, 2_000);
      const stalledLimit = clampInteger(args.scroll?.stalledLimit, 4, 1, 50);
      const batchSize = args.returnBatches ? clampInteger(args.batchSize, 25, 1, 1_000) : 0;
      const progressEverySteps = clampInteger(args.progressEverySteps, 1, 1, 100);
      const containerSelector = collectionContainerSelector(args);
      const anchorSelector = collectionAnchorSelector(args);
      const prelude = framePrelude(args.frameSelector);
      const containerExpr = buildScrollContainerExpression(containerSelector, anchorSelector);
      const seen = new Set(args.state?.seenIds || []);
      const items = partialItems;
      const batches: Record<string, unknown>[][] = [];
      let pendingBatch: Record<string, unknown>[] = [];
      const progress: Record<string, unknown>[] = [];
      let scrollY = 0;
      let stalled = 0;
      let steps = 0;
      let missingIdentityCount = 0;
      const startedAt = Date.now();
      let stableSignature = '';
      let stableRounds = 0;
      const stopWhen = args.stopWhen;

      const snapshot = async (): Promise<ScrollSnapshot> =>
        (await this.evaluate(
          tabId,
          `(async () => {
            try {
              ${prelude}
              const c = ${containerExpr};
              if (!c) return { success: false, error: 'Scroll container not found' };
              const cards = Array.from(doc.querySelectorAll(${JSON.stringify(args.cardSelector)}));
              const top = c === doc.scrollingElement ? win.scrollY : c.scrollTop;
              const max = Math.max(0, c.scrollHeight - c.clientHeight);
              const sample = cards.slice(0, 4).map(el =>
                (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 240)
              ).join('\\u241f');
              const busy = !!doc.querySelector('[aria-busy="true"], [data-loading="true"], [data-testid*="loading" i], .loading, .is-loading');
              return {
                success: true,
                top,
                max,
                atTop: top <= 1,
                atBottom: top >= max - 1,
                scrollHeight: c.scrollHeight,
                clientHeight: c.clientHeight,
                cardCount: cards.length,
                cardSample: sample,
                busy,
                target: c === doc.scrollingElement ? 'document.scrollingElement' : c.id ? '#' + c.id : c.tagName.toLowerCase(),
              };
            } catch (e) {
              return { success: false, error: e.message || String(e) };
            }
          })()`,
        )) as ScrollSnapshot;

      const restoreScroll = async (value: number) => {
        await this.evaluate(
          tabId,
          `(async () => {
            ${prelude}
            const c = ${containerExpr};
            if (!c) return false;
            const max = Math.max(0, c.scrollHeight - c.clientHeight);
            const top = Math.max(0, Math.min(max, ${JSON.stringify(value)}));
            if (c === doc.scrollingElement) win.scrollTo(0, top);
            else c.scrollTop = top;
            return true;
          })()`,
        );
      };

      const scrollBy = async (direction: 1 | -1) =>
        this.evaluate(
          tabId,
          `(async () => {
            ${prelude}
            const c = ${containerExpr};
            if (!c) return false;
            const delta = ${direction * step};
            if (c === doc.scrollingElement) win.scrollBy(0, delta);
            else if (typeof c.scrollBy === 'function') c.scrollBy({ top: delta, behavior: 'auto' });
            else c.scrollTop += delta;
            return true;
          })()`,
        );

      const waitForStable = async (initial: ScrollSnapshot): Promise<ScrollSnapshot> => {
        await sleep(waitMs);
        let current = initial;
        let previousSignature = '';
        let stableSince = Date.now();
        const deadline = Date.now() + waitTimeoutMs;
        while (Date.now() < deadline) {
          if (signal?.aborted) return current;
          current = await snapshot();
          if ((current as any).success === false) return current;
          const signature = JSON.stringify([
            current.top,
            current.max,
            current.scrollHeight,
            current.cardCount,
            current.cardSample,
            current.busy,
          ]);
          if (signature !== previousSignature) {
            previousSignature = signature;
            stableSince = Date.now();
          }
          if (!current.busy && Date.now() - stableSince >= settleMs) return current;
          await sleep(Math.min(200, Math.max(50, Math.floor(settleMs / 2))));
        }
        return current;
      };

      const extract = async () => {
        const output = (await this.evaluate(
          tabId,
          `(async () => {
            ${prelude}
            return (${extractRecordsFromDom.toString()})(${root}, ${JSON.stringify(args.cardSelector)}, ${JSON.stringify(args.fields)}, [], false);
          })()`,
        )) as { records?: Record<string, unknown>[] };
        let added = 0;
        for (const record of output?.records || []) {
          const identityParts = args.identityFields.map((field) =>
            normalizeIdentityPart(record[field]),
          );
          if (!identityParts.some(Boolean)) missingIdentityCount += 1;
          const identity = identityKey(record, args.identityFields);
          if (!seen.has(identity)) {
            seen.add(identity);
            items.push(record);
            if (batchSize > 0) {
              pendingBatch.push(record);
              if (pendingBatch.length >= batchSize) {
                batches.push(pendingBatch);
                pendingBatch = [];
              }
            }
            added += 1;
          }
        }
        return added;
      };
      const checkStop = async (current?: ScrollSnapshot): Promise<string | null> => {
        if (!stopWhen?.type) return null;
        if (stopWhen.type === 'textMatch') {
          const pattern = String(stopWhen.pattern || '')
            .trim()
            .toLocaleLowerCase();
          if (!pattern) return null;
          const found = await this.evaluate(
            tabId,
            `(async () => ${prelude} String(doc.body?.innerText || doc.body?.textContent || '').toLocaleLowerCase().includes(${JSON.stringify(pattern)}))()`,
          );
          return found ? 'text_match' : null;
        }
        if (stopWhen.type === 'selector') {
          if (!stopWhen.selector) return null;
          const found = await this.evaluate(
            tabId,
            `(async () => ${prelude} !!doc.querySelector(${JSON.stringify(stopWhen.selector)}))()`,
          );
          return found ? 'selector_found' : null;
        }
        if (stopWhen.type === 'networkComplete') {
          if (!stopWhen.urlPattern) return null;
          const found = await this.evaluate(
            tabId,
            `(async () => ${prelude} performance.getEntriesByType('resource').some((entry) => String(entry.name || '').includes(${JSON.stringify(stopWhen.urlPattern)}) && Number(entry.responseEnd || 0) > 0))()`,
          );
          return found ? 'network_complete' : null;
        }
        if (stopWhen.type === 'jsCondition') {
          if (!stopWhen.condition) return null;
          const found = await this.evaluate(
            tabId,
            `(async () => { ${prelude} try { return Boolean((() => { const document = doc; const window = win; return (${stopWhen.condition}); })()); } catch (_) { return false; } })()`,
          );
          return found ? 'js_condition' : null;
        }
        const snapshotValue = current || (await snapshot());
        if (!snapshotValue || (snapshotValue as any).success === false) return null;
        const signature = JSON.stringify([
          snapshotValue.top,
          snapshotValue.max,
          snapshotValue.scrollHeight,
          snapshotValue.cardCount,
          snapshotValue.cardSample,
        ]);
        if (!snapshotValue.busy && signature === stableSignature) stableRounds += 1;
        else {
          stableSignature = signature;
          stableRounds = snapshotValue.busy ? 0 : 1;
        }
        const requiredRounds = clampInteger(stopWhen.stableRounds, 3, 1, 50);
        return stableRounds >= requiredRounds
          ? stopWhen.type === 'networkIdle'
            ? 'network_idle'
            : 'stable'
          : null;
      };
      const scan = async (direction: 1 | -1, maxSteps: number) => {
        for (let index = 0; index < maxSteps; index += 1) {
          if (Date.now() - startedAt >= maxDurationMs) return 'timeout';
          if (signal?.aborted) return 'cancelled';
          const added = await extract();
          if (items.length >= maxItems) return 'max_items';
          const before = await snapshot();
          if (!before || (before as any).success === false) return 'failed';
          const stopReason = await checkStop(before);
          if (stopReason) return `stop:${stopReason}`;
          scrollY = before.top;
          if ((direction > 0 && before.atBottom) || (direction < 0 && before.atTop)) return 'edge';
          await scrollBy(direction);
          const after = await waitForStable(before);
          if (!after || (after as any).success === false) return 'failed';
          scrollY = after.top;
          stalled = added || after.top !== before.top ? 0 : stalled + 1;
          steps += 1;
          if (args.returnProgress && steps % progressEverySteps === 0 && progress.length < 2_000) {
            const progressSnapshot = {
              step: steps,
              direction: direction > 0 ? 'down' : 'up',
              added,
              collected: items.length,
              scrollY,
              atBottom: after.atBottom,
              target: after.target,
            };
            progress.push(progressSnapshot);
          }
          if (reportProgress && steps % progressEverySteps === 0) {
            void reportProgress({
              phase: 'scrolling',
              completed: steps,
              collected: items.length,
              tabId,
              ...{
                step: steps,
                direction: direction > 0 ? 'down' : 'up',
                added,
                scrollY,
                atBottom: after.atBottom,
                target: after.target,
              },
            });
          }
          if (stalled >= stalledLimit) return 'stalled';
        }
        return 'stalled';
      };

      const initial = await snapshot();
      if (!initial || (initial as any).success === false) {
        throw new Error((initial as any)?.error || 'scroll_state_failed');
      }
      if (
        typeof args.state?.scrollY === 'number' &&
        Math.abs(initial.top - args.state.scrollY) > 1
      ) {
        await restoreScroll(args.state.scrollY);
        await sleep(50);
      }
      scrollY = (await snapshot()).top;
      const down = await scan(1, Math.max(10, Math.min(500, maxItems * 2)));
      stalled = 0;
      const up =
        args.scroll?.rescanUp && (down === 'edge' || down === 'stalled')
          ? await scan(-1, stalledLimit * 2)
          : null;
      if (pendingBatch.length > 0) batches.push(pendingBatch);
      const stopReason =
        [down, up]
          .find((value) => typeof value === 'string' && value.startsWith('stop:'))
          ?.slice(5) ||
        (down === 'cancelled' || up === 'cancelled'
          ? 'cancelled'
          : down === 'timeout' || up === 'timeout'
            ? 'timeout'
            : down === 'failed' || up === 'failed'
              ? 'failed'
              : down === 'max_items' || up === 'max_items'
                ? 'max_items'
                : down === 'edge' || up === 'edge'
                  ? 'end'
                  : 'stalled');
      return result({
        success: stopReason !== 'failed',
        items: items.slice(0, maxItems),
        stopReason,
        state: {
          seenIds: [...seen],
          scrollY,
          pageUrl: tab.url,
          containerTarget: (await snapshot()).target,
        },
        progress: args.returnProgress ? progress : undefined,
        batches: args.returnBatches ? batches : undefined,
        stats: {
          steps,
          collected: items.length,
          missingIdentityCount,
          elapsedMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      return result(
        {
          success: false,
          reason: error instanceof Error ? error.message : 'failed',
          items: partialItems.slice(0),
          partial: partialItems.length > 0,
        },
        true,
      );
    }
  }
}

type BatchTarget = Target & {
  id?: string;
  label?: string;
  state?: CollectionState;
  containerSelector?: string;
  anchorSelector?: string;
  scroll?: CollectionScroll;
};

class CollectVirtualListsTool extends CollectorTool {
  name = TOOL_NAMES.BROWSER.COLLECT_VIRTUAL_LISTS;

  async execute(
    args: Omit<CollectionArgs, 'tabId' | 'windowId' | 'state'> & {
      targets: BatchTarget[];
      maxConcurrency?: number;
      failFast?: boolean;
    },
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult> {
    if (!Array.isArray(args.targets) || args.targets.length === 0 || args.targets.length > 100) {
      return result(
        { success: false, reason: 'targets must contain between 1 and 100 targets' },
        true,
      );
    }
    if (!args.cardSelector || !args.fields?.length || !args.identityFields?.length) {
      return result({ success: false, reason: 'invalid_parameters' }, true);
    }
    const targetKeys = new Set<string>();
    for (const target of args.targets) {
      const key =
        typeof target.tabId === 'number' ? `tab:${target.tabId}` : `window:${target.windowId}`;
      if (targetKeys.has(key)) {
        return result({ success: false, reason: `duplicate_target:${key}` }, true);
      }
      targetKeys.add(key);
    }

    const maxConcurrency = clampInteger(args.maxConcurrency, 3, 1, 8);
    const results: Record<string, unknown>[] = new Array(args.targets.length);
    let cursor = 0;
    let failed = 0;
    let stopped = false;
    let completed = 0;

    const worker = async () => {
      while (!signal?.aborted && !stopped) {
        const index = cursor++;
        if (index >= args.targets.length) return;
        const target = args.targets[index];
        if (typeof target.tabId !== 'number' && typeof target.windowId !== 'number') {
          failed += 1;
          results[index] = {
            success: false,
            target,
            reason: 'target requires tabId or windowId',
          };
          if (args.failFast) stopped = true;
          continue;
        }
        try {
          const targetId =
            target.id ||
            (typeof target.tabId === 'number'
              ? `tab:${target.tabId}`
              : `window:${target.windowId}`);
          const targetProgress = reportProgress
            ? (progress: Record<string, unknown>) => reportProgress({ ...progress, targetId })
            : undefined;
          const response = await collectVirtualListTool.execute(
            {
              ...args,
              ...target,
              state: target.state,
              targets: undefined,
              maxConcurrency: undefined,
              failFast: undefined,
              id: undefined,
              label: undefined,
            } as unknown as CollectionArgs,
            signal,
            targetProgress,
          );
          const parsed = parseResult(response);
          const item = {
            ...parsed,
            success: parsed.success !== false && !response.isError,
            target: { ...target, state: undefined },
          };
          results[index] = item;
          completed += 1;
          void reportProgress?.({
            phase: 'target_complete',
            completed,
            total: args.targets.length,
            targetId,
            collected: Array.isArray(parsed.items) ? parsed.items.length : 0,
            success: item.success,
          });
          if (item.success === false) {
            failed += 1;
            if (args.failFast) stopped = true;
          }
        } catch (error) {
          failed += 1;
          results[index] = {
            success: false,
            target: { ...target, state: undefined },
            reason: error instanceof Error ? error.message : String(error),
          };
          completed += 1;
          void reportProgress?.({
            phase: 'target_complete',
            completed,
            total: args.targets.length,
            targetId:
              target.id ||
              (typeof target.tabId === 'number'
                ? `tab:${target.tabId}`
                : `window:${target.windowId}`),
            success: false,
          });
          if (args.failFast) stopped = true;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(maxConcurrency, args.targets.length) }, worker),
    );

    if (signal?.aborted) {
      for (let index = 0; index < results.length; index += 1) {
        if (!results[index])
          results[index] = { success: false, target: args.targets[index], reason: 'cancelled' };
      }
    } else if (stopped) {
      for (let index = 0; index < results.length; index += 1) {
        if (!results[index])
          results[index] = { success: false, target: args.targets[index], reason: 'fail_fast' };
      }
    }

    return result(
      {
        success: !signal?.aborted && failed === 0 && !stopped,
        partial: failed > 0 && results.some((item) => item?.success === true),
        totalTargets: args.targets.length,
        completed: results.filter(Boolean).length,
        failed,
        maxConcurrency,
        results,
      },
      failed > 0 && results.every((item) => item?.success === false),
    );
  }
}

type CrawlLinksArgs = Target & {
  startUrls: string[];
  linkSelector: string;
  maxDepth?: number;
  maxNodes?: number;
  sameOriginOnly?: boolean;
  dedupeBy?: 'url';
  extract?: { selector?: string; fields?: Field[] };
  retries?: number;
  retryDelayMs?: number;
  maxDurationMs?: number;
  waitTimeoutMs?: number;
};

type CrawlQueueItem = { url: string; depth: number };

function normalizeCrawlUrl(value: string, base?: string): string | null {
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

class CrawlLinksTool extends CollectorTool {
  name = TOOL_NAMES.BROWSER.CRAWL_LINKS;

  private async waitForComplete(
    tabId: number,
    timeoutMs: number,
    requireEvent = false,
  ): Promise<void> {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && !requireEvent) return;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        if (error) reject(error);
        else resolve();
      };
      const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
      };
      const timer = setTimeout(() => finish(new Error('navigation_timeout')), timeoutMs);
      chrome.tabs.onUpdated.addListener(onUpdated);
      void chrome.tabs
        .get(tabId)
        .then((current) => {
          if (current.status === 'complete') finish();
        })
        .catch(() => finish(new Error('target_tab_not_found')));
    });
  }

  private async navigate(
    tabId: number,
    url: string,
    timeoutMs: number,
    reload = false,
  ): Promise<string> {
    const current = await chrome.tabs.get(tabId);
    if (current.url !== url) {
      const ready = this.waitForComplete(tabId, timeoutMs, true);
      await chrome.tabs.update(tabId, { url });
      await ready;
    } else if (reload) {
      const ready = this.waitForComplete(tabId, timeoutMs, true);
      await chrome.tabs.reload(tabId);
      await ready;
    } else await this.waitForComplete(tabId, timeoutMs);
    await sleep(50);
    return (await chrome.tabs.get(tabId)).url || url;
  }

  async execute(
    args: CrawlLinksArgs,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult> {
    if (
      !Array.isArray(args.startUrls) ||
      args.startUrls.length === 0 ||
      !args.linkSelector ||
      (args.dedupeBy && args.dedupeBy !== 'url')
    )
      return result({ success: false, reason: 'invalid_parameters', pages: [], errors: [] }, true);

    const pages: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];
    try {
      const tab = await this.resolveTab(args);
      const tabId = tab.id!;
      const maxDepth = clampInteger(args.maxDepth, 5, 0, 50);
      const maxNodes = clampInteger(args.maxNodes, 50, 1, 10_000);
      const retries = clampInteger(args.retries, 1, 0, 5);
      const retryDelayMs = clampInteger(args.retryDelayMs, 250, 0, 10_000);
      const waitTimeoutMs = clampInteger(args.waitTimeoutMs, 20_000, 1_000, 60_000);
      const maxDurationMs = clampInteger(args.maxDurationMs, 600_000, 1_000, 1_800_000);
      const startedAt = Date.now();
      const queue: CrawlQueueItem[] = [];
      const scheduled = new Set<string>();
      const origins = new Set<string>();
      for (const input of args.startUrls) {
        const url = normalizeCrawlUrl(input);
        if (!url || scheduled.has(url)) continue;
        scheduled.add(url);
        queue.push({ url, depth: 0 });
        origins.add(new URL(url).origin);
      }
      if (!queue.length)
        return result({ success: false, reason: 'no_valid_start_urls', pages, errors }, true);

      while (queue.length && pages.length + errors.length < maxNodes) {
        if (signal?.aborted) break;
        if (Date.now() - startedAt >= maxDurationMs) break;
        const node = queue.shift()!;
        let pageUrl = node.url;
        let output: { links?: string[]; data?: Record<string, unknown> } | null = null;
        let lastError = 'navigation_failed';
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            pageUrl = await this.navigate(tabId, node.url, waitTimeoutMs, attempt > 0);
            output = (await this.evaluate(
              tabId,
              `(async () => {
                ${framePrelude(args.frameSelector)}
                const linkSelector = ${JSON.stringify(args.linkSelector)};
                const links = Array.from(doc.querySelectorAll(linkSelector)).map((element) => element.href || element.getAttribute('href')).filter(Boolean);
                const scope = ${args.extract?.selector ? `doc.querySelector(${JSON.stringify(args.extract.selector)}) || doc` : 'doc'};
                const fields = ${JSON.stringify(args.extract?.fields || [])};
                const data = {};
                for (const field of fields) {
                  const element = field.selector ? scope.querySelector(field.selector) : scope;
                  if (!element) { data[field.name] = null; continue; }
                  if (field.type === 'attribute') data[field.name] = field.attribute ? element.getAttribute(field.attribute) : null;
                  else if (field.type === 'href') data[field.name] = element.href || element.getAttribute('href');
                  else if (field.type === 'src') data[field.name] = element.src || element.getAttribute('src');
                  else if (field.type === 'html') data[field.name] = element.innerHTML;
                  else if (field.type === 'outerHtml') data[field.name] = element.outerHTML;
                  else data[field.name] = (element.textContent || '').replace(/\\s+/g, ' ').trim();
                }
                return { links, data };
              })()`,
            )) as { links?: string[]; data?: Record<string, unknown> };
            break;
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            if (attempt < retries) await sleep(retryDelayMs);
          }
        }
        if (!output) {
          errors.push({
            url: node.url,
            depth: node.depth,
            reason: lastError,
            attempts: retries + 1,
          });
          void reportProgress?.({
            phase: 'page_failed',
            completed: pages.length + errors.length,
            url: node.url,
            depth: node.depth,
          });
          continue;
        }
        const discovered: string[] = [];
        for (const link of output.links || []) {
          const normalized = normalizeCrawlUrl(link, pageUrl);
          if (!normalized || scheduled.has(normalized)) continue;
          if (args.sameOriginOnly && !origins.has(new URL(normalized).origin)) continue;
          scheduled.add(normalized);
          discovered.push(normalized);
          if (node.depth < maxDepth) queue.push({ url: normalized, depth: node.depth + 1 });
        }
        pages.push({
          url: pageUrl,
          requestedUrl: node.url,
          depth: node.depth,
          links: discovered,
          ...(args.extract ? { data: output.data || {} } : {}),
        });
        void reportProgress?.({
          phase: 'page_complete',
          completed: pages.length + errors.length,
          total: maxNodes,
          url: pageUrl,
          depth: node.depth,
          discovered: discovered.length,
        });
      }
      const stopReason = signal?.aborted
        ? 'cancelled'
        : Date.now() - startedAt >= maxDurationMs
          ? 'timeout'
          : pages.length + errors.length >= maxNodes
            ? 'max_nodes'
            : 'exhausted';
      return result(
        {
          success: pages.length > 0 && !signal?.aborted,
          partial: errors.length > 0 || Boolean(queue.length),
          stopReason,
          pages,
          errors,
          queued: queue.length,
          visited: pages.length + errors.length,
          elapsedMs: Date.now() - startedAt,
        },
        pages.length === 0,
      );
    } catch (error) {
      return result(
        {
          success: false,
          partial: pages.length > 0,
          reason: error instanceof Error ? error.message : 'failed',
          pages,
          errors,
        },
        pages.length === 0,
      );
    }
  }
}

type ThreadFields = Record<
  string,
  string | { selector: string; type?: 'text' | 'href' | 'html' | 'attribute'; attribute?: string }
>;

type ExtractThreadArgs = Target & {
  rootSelector: string;
  itemSelector: string;
  excludeSelector?: string;
  includeNested?: boolean;
  fields: ThreadFields;
  limit?: number;
  scroll?: boolean;
  maxScrolls?: number;
  waitMs?: number;
  stopWhen?: { type?: 'textMatch' | 'selector'; pattern?: string; selector?: string };
};

class ExtractThreadTool extends CollectorTool {
  name = TOOL_NAMES.BROWSER.EXTRACT_THREAD;

  async execute(
    args: ExtractThreadArgs,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult> {
    if (!args.rootSelector || !args.itemSelector || !args.fields || typeof args.fields !== 'object')
      return result({ success: false, reason: 'invalid_parameters', items: [] }, true);
    const items: Record<string, unknown>[] = [];
    try {
      const tab = await this.resolveTab(args);
      const tabId = tab.id!;
      const limit = clampInteger(args.limit, 20, 1, 10_000);
      const maxScrolls = clampInteger(args.maxScrolls, 20, 0, 500);
      const waitMs = clampInteger(args.waitMs, 800, 50, 10_000);
      const seen = new Set<string>();
      let lastSignature = '';
      let stableRounds = 0;
      let stopReason = 'end';
      for (let scroll = 0; scroll <= maxScrolls; scroll += 1) {
        if (signal?.aborted) {
          stopReason = 'cancelled';
          break;
        }
        const output = (await this.evaluate(
          tabId,
          `(async () => {
            ${framePrelude(args.frameSelector)}
            const root = doc.querySelector(${JSON.stringify(args.rootSelector)});
            if (!root) return { success: false, reason: 'root_not_found', items: [] };
            const fields = ${JSON.stringify(args.fields)};
            const excluded = ${JSON.stringify(args.excludeSelector || '')};
            const includeNested = ${args.includeNested === true};
            const records = Array.from(root.querySelectorAll(${JSON.stringify(args.itemSelector)})).filter((item) => {
              if (!includeNested && item.parentElement?.closest(${JSON.stringify(args.itemSelector)})) return false;
              if (!excluded) return true;
              try { return !item.matches(excluded) && !item.querySelector(excluded); } catch (_) { return true; }
            }).map((item) => {
              const record = {};
              for (const [name, definition] of Object.entries(fields)) {
                const spec = typeof definition === 'string' ? { selector: definition, type: 'text' } : definition;
                const element = spec.selector ? item.querySelector(spec.selector) : item;
                if (!element) { record[name] = null; continue; }
                if (spec.type === 'href') record[name] = element.href || element.getAttribute('href');
                else if (spec.type === 'html') record[name] = element.innerHTML;
                else if (spec.type === 'attribute') record[name] = spec.attribute ? element.getAttribute(spec.attribute) : null;
                else record[name] = (element.textContent || '').replace(/\\s+/g, ' ').trim();
              }
              return { record, text: (item.textContent || '').replace(/\\s+/g, ' ').trim() };
            });
            const container = root.scrollHeight > root.clientHeight + 1 ? root : (doc.scrollingElement || doc.documentElement);
            const top = container === doc.scrollingElement || container === doc.documentElement ? win.scrollY : container.scrollTop;
            const max = container === doc.scrollingElement || container === doc.documentElement ? Math.max(0, doc.documentElement.scrollHeight - win.innerHeight) : Math.max(0, container.scrollHeight - container.clientHeight);
            const text = records.map((entry) => entry.text).join('\\n');
            const stop = ${JSON.stringify(args.stopWhen || null)};
            const matched = stop?.type === 'textMatch' && stop.pattern ? text.toLocaleLowerCase().includes(String(stop.pattern).toLocaleLowerCase()) : stop?.type === 'selector' && stop.selector ? !!root.querySelector(stop.selector) : false;
            return { success: true, records, matched, top, max, signature: JSON.stringify([top, max, records.length, text.slice(-1000)]) };
          })()`,
        )) as {
          success?: boolean;
          reason?: string;
          records?: Array<{ record: Record<string, unknown>; text: string }>;
          matched?: boolean;
          top?: number;
          max?: number;
          signature?: string;
        };
        if (output?.success === false) throw new Error(output.reason || 'thread_root_not_found');
        for (const entry of output?.records || []) {
          const recordKey = String(
            entry.record.url || entry.record.id || JSON.stringify(entry.record),
          );
          if (!seen.has(recordKey)) {
            seen.add(recordKey);
            items.push(entry.record);
          }
        }
        if (output?.matched) {
          stopReason = args.stopWhen?.type === 'selector' ? 'selector_found' : 'text_match';
          break;
        }
        if (items.length >= limit) {
          stopReason = 'max_items';
          break;
        }
        if (!args.scroll || scroll >= maxScrolls) {
          stopReason = args.scroll ? 'max_scrolls' : 'scroll_disabled';
          break;
        }
        if (output?.signature === lastSignature) stableRounds += 1;
        else {
          lastSignature = output?.signature || '';
          stableRounds = 0;
        }
        if (stableRounds >= 3 && (output?.top || 0) >= (output?.max || 0) - 1) {
          stopReason = 'stable';
          break;
        }
        if ((output?.top || 0) >= (output?.max || 0) - 1) {
          await sleep(waitMs);
          continue;
        }
        await this.evaluate(
          tabId,
          `(async () => { ${framePrelude(args.frameSelector)} const root = doc.querySelector(${JSON.stringify(args.rootSelector)}); const container = root && root.scrollHeight > root.clientHeight + 1 ? root : (doc.scrollingElement || doc.documentElement); if (container === doc.scrollingElement || container === doc.documentElement) win.scrollBy(0, Math.max(200, Math.floor(win.innerHeight * 0.8))); else container.scrollBy ? container.scrollBy({ top: Math.max(200, Math.floor(container.clientHeight * 0.8)), behavior: 'auto' }) : container.scrollTop += Math.max(200, Math.floor(container.clientHeight * 0.8)); return true; })()`,
        );
        await sleep(waitMs);
        void reportProgress?.({
          phase: 'scrolling',
          completed: scroll + 1,
          total: maxScrolls,
          collected: items.length,
          tabId,
        });
      }
      return result({
        success: stopReason !== 'cancelled',
        items: items.slice(0, limit),
        stopReason,
        complete: ['end', 'stable', 'scroll_disabled'].includes(stopReason),
        collected: items.length,
      });
    } catch (error) {
      return result(
        {
          success: false,
          partial: items.length > 0,
          reason: error instanceof Error ? error.message : 'failed',
          items,
        },
        true,
      );
    }
  }
}

class WaitExtractResponseTool extends CollectorTool {
  name = TOOL_NAMES.BROWSER.WAIT_EXTRACT_RESPONSE;

  async execute(
    args: Target & {
      action:
        | { type: 'navigate'; url: string }
        | { type: 'click'; candidates: Candidate[]; scopeSelector?: string };
      confirm?: { candidates: Candidate[]; scopeSelector?: string; delayMs?: number };
      response: {
        urlPattern: string;
        timeoutMs?: number;
        includeBody?: boolean;
        maxBodyBytes?: number;
      };
      extract?: { recordsPath: string; fields: Record<string, string> };
    },
  ): Promise<ToolResult> {
    if (!args.action || !args.response?.urlPattern)
      return result({ success: false, reason: 'invalid_parameters', records: [] }, true);
    let tabId: number | undefined;
    let captureStarted = false;
    try {
      const tab = await this.resolveTab(args);
      tabId = tab.id!;
      const timeoutMs = Math.max(100, Math.min(args.response.timeoutMs || 15_000, 120_000));
      const capture = networkDebuggerStartTool as unknown as {
        captureData: Map<number, { requests: Record<string, Record<string, unknown>> }>;
      };
      if (capture.captureData.has(tabId))
        return result({ success: false, reason: 'network_capture_active', records: [] }, true);
      const startedCapture = await networkDebuggerStartTool.execute({
        tabId,
        maxCaptureTime: timeoutMs + 5_000,
        inactivityTimeout: 0,
        includeStatic: false,
      });
      if (startedCapture.isError) return startedCapture;
      captureStarted = true;
      if (args.action.type === 'navigate')
        await chrome.tabs.update(tabId, { url: args.action.url });
      else {
        const click = await findAndClickTool.execute({ ...args, ...args.action });
        if (click.isError) return click;
        if (args.confirm?.candidates?.length) {
          await sleep(Math.max(0, Math.min(args.confirm.delayMs || 150, 5_000)));
          const confirm = await findAndClickTool.execute({
            ...args,
            candidates: args.confirm.candidates,
            scopeSelector: args.confirm.scopeSelector,
          });
          if (confirm.isError) return confirm;
        }
      }
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const request = Object.values(capture.captureData.get(tabId)?.requests || {}).find(
          (entry) =>
            String(entry.url || '').includes(args.response.urlPattern) &&
            (entry.status === 'complete' || entry.status === 'error'),
        );
        if (request) {
          const raw =
            typeof request.responseBody === 'string'
              ? request.base64Encoded
                ? new TextDecoder().decode(
                    Uint8Array.from(atob(String(request.responseBody)), (char) =>
                      char.charCodeAt(0),
                    ),
                  )
                : String(request.responseBody)
              : '';
          const responseBody =
            args.response.includeBody === false
              ? undefined
              : raw.slice(0, Math.max(256, Math.min(args.response.maxBodyBytes || 16_000, 64_000)));
          let records: Record<string, unknown>[] = [];
          let parseError: string | undefined;
          if (args.extract?.recordsPath) {
            try {
              records = extractJsonRecords(
                JSON.parse(raw),
                args.extract.recordsPath,
                args.extract.fields,
              );
            } catch (error) {
              parseError = error instanceof Error ? error.message : 'response_json_parse_failed';
            }
          }
          const statusCode = Number(request.statusCode || 0);
          const httpOk = statusCode >= 200 && statusCode < 300;
          return result(
            {
              success: httpOk,
              matched: true,
              httpOk,
              matchedCount: records.length,
              records,
              parseError,
              response: {
                url: request.url,
                method: request.method,
                statusCode: request.statusCode,
                statusText: request.statusText,
                requestBody: request.requestBody,
                responseBody,
                errorText: request.errorText,
              },
              reason: httpOk
                ? undefined
                : request.status === 'error'
                  ? 'network_error'
                  : 'http_error',
            },
            !httpOk,
          );
        }
        await sleep(100);
      }
      return result({ success: false, reason: 'timeout', records: [] }, true);
    } catch (error) {
      return result(
        { success: false, reason: error instanceof Error ? error.message : 'failed', records: [] },
        true,
      );
    } finally {
      if (captureStarted && tabId !== undefined)
        await networkDebuggerStopTool.execute({ tabId }).catch(() => undefined);
    }
  }
}

class CaptureDebugBundleTool extends CollectorTool {
  name = TOOL_NAMES.BROWSER.CAPTURE_DEBUG_BUNDLE;

  async execute(
    args: Target & { reason: string; domLimit?: number; consoleLimit?: number },
  ): Promise<ToolResult> {
    try {
      const tab = await this.resolveTab(args);
      const snapshot = await diagnosticSnapshotTool.execute({
        tabId: tab.id,
        domLimit: args.domLimit,
        consoleLimit: args.consoleLimit,
      });
      if (snapshot.isError) return snapshot;
      const data = JSON.parse((snapshot.content[0] as { text: string }).text) as Record<
        string,
        any
      >;
      const stamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14);
      const safeReason = String(args.reason || 'diagnostic')
        .replace(/[^a-z0-9_-]/gi, '_')
        .slice(0, 48);
      const folder = `debug/${stamp}_${safeReason || 'diagnostic'}`;
      const network = (data.network?.requests || []).map((entry: Record<string, unknown>) => ({
        url: entry.url,
        method: entry.method,
        type: entry.type,
        status: entry.status,
        statusCode: entry.statusCode,
        mimeType: entry.mimeType,
        requestTime: entry.requestTime,
        responseTime: entry.responseTime,
        encodedDataLength: entry.encodedDataLength,
      }));
      const download = async (filename: string, content: BlobPart, type: string) => {
        const url = URL.createObjectURL(new Blob([content], { type }));
        try {
          return {
            filename,
            downloadId: await chrome.downloads.download({ url, filename, saveAs: false }),
          };
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 1_000);
        }
      };
      const files = await Promise.all([
        download(
          `${folder}/screenshot.png`,
          Uint8Array.from(atob(data.screenshotBase64 || ''), (c) => c.charCodeAt(0)),
          'image/png',
        ),
        download(`${folder}/dom.html`, data.dom || '', 'text/html'),
        download(
          `${folder}/console.json`,
          JSON.stringify(data.console || [], null, 2),
          'application/json',
        ),
        download(`${folder}/network.json`, JSON.stringify(network, null, 2), 'application/json'),
        download(
          `${folder}/meta.json`,
          JSON.stringify(
            {
              tabId: tab.id,
              url: tab.url,
              reason: args.reason,
              capturedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
          'application/json',
        ),
      ]);
      return result({ success: true, folder, files });
    } catch (error) {
      return result(
        { success: false, reason: error instanceof Error ? error.message : 'failed' },
        true,
      );
    }
  }
}

type StoredTask = {
  tabId: number;
  windowId: number;
  state: Record<string, unknown>;
  updatedAt: number;
};
const RESUME_KEY = 'mcp_resumable_tab_tasks';

class ResumeTabTaskTool extends CollectorTool {
  name = TOOL_NAMES.BROWSER.RESUME_TAB_TASK;

  async execute(
    args: Target & {
      action: 'save' | 'get' | 'clear';
      taskId: string;
      state?: Record<string, unknown>;
    },
  ): Promise<ToolResult> {
    if (!args.taskId || !['save', 'get', 'clear'].includes(args.action))
      return result({ success: false, reason: 'invalid_parameters' }, true);
    try {
      const tasks = ((await chrome.storage.local.get(RESUME_KEY))[RESUME_KEY] || {}) as Record<
        string,
        StoredTask
      >;
      if (args.action === 'clear') {
        delete tasks[args.taskId];
        await chrome.storage.local.set({ [RESUME_KEY]: tasks });
        return result({ success: true, taskId: args.taskId, task: null });
      }
      if (args.action === 'save') {
        const tab = await this.resolveTab(args);
        if (!tab.id || typeof tab.windowId !== 'number') throw new Error('target_tab_not_found');
        tasks[args.taskId] = {
          tabId: tab.id,
          windowId: tab.windowId,
          state: args.state || {},
          updatedAt: Date.now(),
        };
        await chrome.storage.local.set({ [RESUME_KEY]: tasks });
      }
      const task = tasks[args.taskId];
      if (!task) return result({ success: true, taskId: args.taskId, task: null });
      const tab = await this.tryGetTab(task.tabId);
      return result({
        success: true,
        taskId: args.taskId,
        task: { ...task, tab: tab ? { id: tab.id, windowId: tab.windowId, url: tab.url } : null },
        reason: tab ? null : 'tab_closed',
      });
    } catch (error) {
      return result(
        { success: false, reason: error instanceof Error ? error.message : 'failed' },
        true,
      );
    }
  }
}

export const collectVirtualListTool = new CollectVirtualListTool();
export const collectVirtualListsTool = new CollectVirtualListsTool();
export const crawlLinksTool = new CrawlLinksTool();
export const extractThreadTool = new ExtractThreadTool();
export const waitExtractResponseTool = new WaitExtractResponseTool();
export const captureDebugBundleTool = new CaptureDebugBundleTool();
export const resumeTabTaskTool = new ResumeTabTaskTool();
