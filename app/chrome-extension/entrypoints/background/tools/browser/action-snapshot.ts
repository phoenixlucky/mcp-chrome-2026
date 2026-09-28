import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { BaseBrowserToolExecutor } from '../base-browser';

interface ActionSnapshotParams {
  tabId?: number;
  windowId?: number;
  limit?: number;
}

const MAX_SNAPSHOT_OUTPUT_BYTES = 24_000;

export function frameScopedActionRef(frameId: number, ref: string): string {
  return `frame:${frameId}:${ref}`;
}

export function serializeActionSnapshot(snapshot: {
  snapshotId: string;
  tabId: number;
  createdAt: number;
  expiresInMs: number;
  controls: Record<string, unknown>[];
  text: string;
  truncated: boolean;
  stats: { controls: number; [key: string]: number };
  [key: string]: unknown;
}): string {
  const encoder = new TextEncoder();
  const byteLength = (value: string) => encoder.encode(value).byteLength;
  let output = JSON.stringify(snapshot);
  while (byteLength(output) > MAX_SNAPSHOT_OUTPUT_BYTES && snapshot.text.length) {
    snapshot.text = Array.from(snapshot.text)
      .slice(0, Math.floor(Array.from(snapshot.text).length * 0.75))
      .join('');
    snapshot.truncated = true;
    output = JSON.stringify(snapshot);
  }
  while (byteLength(output) > MAX_SNAPSHOT_OUTPUT_BYTES && snapshot.controls.length) {
    snapshot.controls.pop();
    snapshot.truncated = true;
    snapshot.stats.controls = snapshot.controls.length;
    output = JSON.stringify(snapshot);
  }
  if (byteLength(output) > MAX_SNAPSHOT_OUTPUT_BYTES) {
    output = JSON.stringify({
      success: true,
      snapshotId: String(snapshot.snapshotId).slice(0, 128),
      tabId: snapshot.tabId,
      createdAt: snapshot.createdAt,
      expiresInMs: snapshot.expiresInMs,
      controls: [],
      text: '',
      truncated: true,
      stats: { frames: 0, controls: 0 },
    });
  }
  return output;
}

class ActionSnapshotTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_ACTION_SNAPSHOT;

  async execute(args: ActionSnapshotParams): Promise<ToolResult> {
    try {
      const tab = await this.resolveTargetTab(args?.tabId, args?.windowId);
      if (typeof tab.id !== 'number') return createErrorResponse('Target tab has no ID');
      if (tab.status === 'loading') await this.waitForTabReady(tab.id);

      const snapshotId = crypto.randomUUID();
      const maxControls = Math.max(1, Math.min(150, Math.floor(Number(args?.limit) || 150)));
      const helperFiles = ['inject-scripts/accessibility-tree-helper.js'];
      await this.injectContentScript(tab.id, helperFiles, false, 'ISOLATED', true);
      const frames = await chrome.webNavigation?.getAllFrames?.({ tabId: tab.id }).catch(() => []);
      const frameIds = Array.from(
        new Set([0, ...(frames || []).map((frame) => frame.frameId)]),
      ).sort((a, b) => a - b);
      const successful: Array<Record<string, any> & { frameId: number }> = [];
      let remaining = maxControls;
      let skippedFrames = false;
      for (const frameId of frameIds) {
        if (!remaining) {
          skippedFrames = true;
          break;
        }
        try {
          const response = await this.sendMessageToTabWithRetry(
            tab.id,
            {
              action: TOOL_MESSAGE_TYPES.GENERATE_ACTION_SNAPSHOT,
              snapshotId,
              limit: remaining,
            },
            helperFiles,
            frameId,
          );
          if (response?.success) {
            successful.push({ frameId, ...response });
            remaining -= Array.isArray(response.controls) ? response.controls.length : 0;
          }
        } catch {
          // Unreachable frames do not prevent snapshots for the rest of the page.
        }
      }
      const controls = successful.flatMap(({ frameId, controls = [] }) =>
        controls.map((control: Record<string, unknown>) => ({
          ...control,
          ref: frameScopedActionRef(frameId, String(control.ref || '')),
          frameId,
        })),
      );
      if (!successful.length) return createErrorResponse('Could not capture an action snapshot');
      const combinedText = successful
        .map((result) => result.text)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('\n');

      const snapshot = {
        success: true,
        snapshotId,
        tabId: tab.id,
        url: tab.url || '',
        title: successful.find((result) => result.frameId === 0)?.title || '',
        text: combinedText.slice(0, 6_000),
        viewport: successful.find((result) => result.frameId === 0)?.viewport,
        createdAt: Date.now(),
        expiresInMs: 30_000,
        controls,
        truncated:
          skippedFrames ||
          combinedText.length > 6_000 ||
          successful.some((result) => result.truncated),
        stats: { frames: successful.length, controls: controls.length },
      };
      const output = serializeActionSnapshot(snapshot);

      return {
        isError: false,
        content: [{ type: 'text', text: output }],
      };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }
}

export const actionSnapshotTool = new ActionSnapshotTool();
