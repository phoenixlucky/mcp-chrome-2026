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
  background?: boolean;
};

export const crawlLinksTool = new CrawlLinksTool();
