import { type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { diagnosticSnapshotTool } from './diagnostic-snapshot';
import { networkDebuggerStartTool, networkDebuggerStopTool } from './network-capture-debugger';
import { findAndClickTool } from './review-tools';
import { extractRecordsFromDom, type Field } from './review-utils';
import { extractJsonRecords } from './collector-utils';

type Target = { tabId?: number; windowId?: number; frameSelector?: string };
type Candidate = { selector?: string; text?: string; role?: string; type?: 'css' | 'xpath' };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const result = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  isError,
});

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
    args: Target & {
      cardSelector: string;
      fields: Field[];
      identityFields: string[];
      maxItems?: number;
      scroll?: { step?: number; waitMs?: number; stalledLimit?: number; rescanUp?: boolean };
      state?: { seenIds?: string[]; scrollY?: number };
    },
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (!args.cardSelector || !args.fields?.length || !args.identityFields?.length)
      return result({ success: false, reason: 'invalid_parameters', items: [] }, true);
    try {
      const tab = await this.resolveTab(args);
      const tabId = tab.id!;
      const root = args.frameSelector
        ? `document.querySelector(${JSON.stringify(args.frameSelector)})?.contentDocument`
        : 'document';
      const maxItems = Math.max(1, Math.min(args.maxItems || 100, 10_000));
      const step = Math.max(1, args.scroll?.step || 300);
      const waitMs = Math.max(50, args.scroll?.waitMs || 800);
      const stalledLimit = Math.max(1, args.scroll?.stalledLimit || 4);
      const seen = new Set(args.state?.seenIds || []);
      const items: Record<string, unknown>[] = [];
      let scrollY = args.state?.scrollY || 0;
      let stalled = 0;

      const extract = async () => {
        const output = (await this.evaluate(
          tabId,
          `(${extractRecordsFromDom.toString()})(${root}, ${JSON.stringify(args.cardSelector)}, ${JSON.stringify(args.fields)}, [], false)`,
        )) as { records?: Record<string, unknown>[] };
        let added = 0;
        for (const record of output?.records || []) {
          const identity = JSON.stringify(
            args.identityFields.map((field) => record[field] ?? null),
          );
          if (!seen.has(identity)) {
            seen.add(identity);
            items.push(record);
            added += 1;
          }
        }
        return added;
      };
      const scrollState = () =>
        this.evaluate(
          tabId,
          `(() => { const root=${root}; const win=root?.defaultView || window; const top=win.scrollY; const max=Math.max(0, root?.documentElement?.scrollHeight - win.innerHeight || 0); return { top, max, atTop: top <= 1, atBottom: top >= max - 1 }; })()`,
        ) as Promise<{ top: number; max: number; atTop: boolean; atBottom: boolean }>;
      const scan = async (direction: 1 | -1, maxSteps: number) => {
        for (let index = 0; index < maxSteps; index += 1) {
          if (signal?.aborted) return 'cancelled';
          const added = await extract();
          if (items.length >= maxItems) return 'max_items';
          const before = await scrollState();
          if ((direction > 0 && before.atBottom) || (direction < 0 && before.atTop)) return 'edge';
          await this.evaluate(
            tabId,
            `(${root}.defaultView || window).scrollBy(0, ${direction * step})`,
          );
          await sleep(waitMs);
          const after = await scrollState();
          scrollY = after.top;
          stalled = added || after.top !== before.top ? 0 : stalled + 1;
          if (stalled >= stalledLimit) return 'stalled';
        }
        return 'stalled';
      };

      const down = await scan(1, Math.max(10, Math.min(500, maxItems * 2)));
      const up =
        args.scroll?.rescanUp && (down === 'edge' || down === 'stalled')
          ? await scan(-1, stalledLimit * 2)
          : null;
      const stopReason =
        down === 'cancelled' || up === 'cancelled'
          ? 'cancelled'
          : down === 'max_items' || up === 'max_items'
            ? 'max_items'
            : down === 'edge' || up === 'edge'
              ? 'end'
              : 'stalled';
      return result({
        success: true,
        items: items.slice(0, maxItems),
        stopReason,
        state: { seenIds: [...seen], scrollY },
      });
    } catch (error) {
      return result(
        { success: false, reason: error instanceof Error ? error.message : 'failed', items: [] },
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
      response: { urlPattern: string; timeoutMs?: number };
      extract: { recordsPath: string; fields: Record<string, string> };
    },
  ): Promise<ToolResult> {
    if (!args.action || !args.response?.urlPattern || !args.extract?.recordsPath)
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
      }
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const request = Object.values(capture.captureData.get(tabId)?.requests || {}).find(
          (entry) =>
            String(entry.url || '').includes(args.response.urlPattern) &&
            entry.status === 'complete' &&
            typeof entry.responseBody === 'string',
        );
        if (request) {
          const raw = request.base64Encoded
            ? new TextDecoder().decode(
                Uint8Array.from(atob(String(request.responseBody)), (char) => char.charCodeAt(0)),
              )
            : String(request.responseBody);
          const records = extractJsonRecords(
            JSON.parse(raw),
            args.extract.recordsPath,
            args.extract.fields,
          );
          return result({
            success: true,
            matchedCount: records.length,
            records,
            response: { url: request.url, statusCode: request.statusCode },
          });
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
export const waitExtractResponseTool = new WaitExtractResponseTool();
export const captureDebugBundleTool = new CaptureDebugBundleTool();
export const resumeTabTaskTool = new ResumeTabTaskTool();
