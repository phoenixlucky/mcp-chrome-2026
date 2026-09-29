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
        const scrollResult = await scrollTool.execute(
          {
            tabId,
            amount: 800,
            direction: 'down',
            anchorSelector: args.itemSelector,
            background: args.background !== false,
            frameSelector: args.frameSelector,
          },
          signal,
        );
        if (scrollResult.isError) throw new Error('scroll_failed');
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

export const extractThreadTool = new ExtractThreadTool();
export const waitExtractResponseTool = new WaitExtractResponseTool();
