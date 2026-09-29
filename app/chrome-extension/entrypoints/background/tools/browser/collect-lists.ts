import type { ToolProgressReporter, ToolResult } from '@/common/tool-handler';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { diagnosticSnapshotTool } from './diagnostic-snapshot';
import { networkDebuggerStartTool, networkDebuggerStopTool } from './network-capture-debugger';
import { findAndClickTool } from './review-tools';
import { extractRecordsFromDom, type Field } from './review-utils';
import { extractJsonRecords } from './collector-utils';
import { buildScrollContainerExpression, scrollTool } from './scroll';
import { ensureTabRendering, resolveBackgroundMode } from './common';
import {
  CollectorTool,
  result,
  sleep,
  type Target,
  type Candidate,
  type CollectionArgs,
  type CollectionState,
  type CollectionScroll,
  type CollectionStopWhen,
  type ScrollSnapshot,
  clampInteger,
  normalizeIdentityPart,
  identityKey,
  parseResult,
  framePrelude,
  collectionContainerSelector,
  collectionAnchorSelector,
  BACKGROUND_LAYOUT_RETRY_WAIT_MS,
} from './collector-common';

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
      const background = await resolveBackgroundMode(
        tabId,
        args.background ?? args.scroll?.background,
      );
      if (background) await ensureTabRendering(tabId, { signal });
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
      const containerExpr = buildScrollContainerExpression(
        containerSelector,
        anchorSelector,
        background,
      );
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
              const top = c.scrollTop;
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
                visibilityState: doc.visibilityState,
                target: c === doc.scrollingElement ? 'document.scrollingElement' : c.id ? '#' + c.id : c.tagName.toLowerCase(),
              };
            } catch (e) {
              return { success: false, error: e.message || String(e) };
            }
          })()`,
          signal,
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
            c.scrollTop = top;
            return true;
          })()`,
          signal,
        );
      };

      let scrollFailure: Record<string, unknown> | null = null;

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
          const scrollResult = await scrollTool.execute(
            {
              tabId,
              amount: step,
              direction: direction > 0 ? 'down' : 'up',
              containerSelector,
              anchorSelector,
              frameSelector: args.frameSelector,
              background,
            },
            signal,
          );
          const scrollPayload = parseResult(scrollResult);
          if (scrollResult.isError || scrollPayload.success === false) {
            scrollFailure = scrollPayload;
            return 'failed';
          }
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

      let initial = await snapshot();
      if (
        background &&
        initial?.success &&
        initial.top === 0 &&
        initial.scrollHeight === 0 &&
        initial.clientHeight === 0
      ) {
        await sleep(BACKGROUND_LAYOUT_RETRY_WAIT_MS);
        await ensureTabRendering(tabId, { signal });
        const retried = await snapshot();
        if (
          retried?.success &&
          retried.top === 0 &&
          retried.scrollHeight === 0 &&
          retried.clientHeight === 0
        ) {
          return result(
            {
              success: false,
              code: 'BACKGROUND_LAYOUT_UNAVAILABLE',
              retryable: true,
              scrollHeight: 0,
              clientHeight: 0,
              visibilityState: retried.visibilityState || 'hidden',
            },
            true,
          );
        }
        initial = retried;
      }
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
      const failure = scrollFailure as Record<string, unknown> | null;
      if (failure?.code === 'BACKGROUND_LAYOUT_UNAVAILABLE') {
        return result(
          {
            ...failure,
            items: items.slice(0, maxItems),
            partial: items.length > 0,
          },
          true,
        );
      }
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

export const collectVirtualListTool = new CollectVirtualListTool();
export const collectVirtualListsTool = new CollectVirtualListsTool();
