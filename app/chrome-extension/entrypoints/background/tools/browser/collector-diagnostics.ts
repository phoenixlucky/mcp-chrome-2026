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

export const captureDebugBundleTool = new CaptureDebugBundleTool();
export const resumeTabTaskTool = new ResumeTabTaskTool();
