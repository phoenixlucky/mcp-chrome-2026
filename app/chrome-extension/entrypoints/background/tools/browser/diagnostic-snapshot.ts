import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { consoleBuffer } from './console-buffer';
import { networkCaptureStartTool } from './network-capture-web-request';
import { networkDebuggerStartTool } from './network-capture-debugger';

interface DiagnosticSnapshotParams {
  tabId?: number;
  domLimit?: number;
  consoleLimit?: number;
}

class DiagnosticSnapshotTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.DIAGNOSTIC_SNAPSHOT;

  async execute(args: DiagnosticSnapshotParams): Promise<ToolResult> {
    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : undefined) ??
      (await this.getActiveTabInWindow());
    if (!tab?.id) return createErrorResponse('Target tab not found.');
    try {
      await consoleBuffer.ensureStarted(tab.id);
      const [dom, screenshot] = await cdpSessionManager.withSession(
        tab.id,
        'diagnostic-snapshot',
        async () =>
          Promise.all([
            cdpSessionManager.sendCommand(tab.id!, 'Runtime.evaluate', {
              expression: `document.documentElement.outerHTML.slice(0, ${Math.max(1_000, Math.min(args.domLimit || 50_000, 250_000))})`,
              returnByValue: true,
            }),
            cdpSessionManager.sendCommand(tab.id!, 'Page.captureScreenshot', { format: 'png' }),
          ]),
      );
      const capture =
        networkCaptureStartTool.captureData.get(tab.id) ||
        (
          networkDebuggerStartTool as unknown as {
            captureData: Map<number, { requests: Record<string, unknown> }>;
          }
        ).captureData?.get(tab.id);
      const requests = capture ? Object.values(capture.requests).slice(-50) : [];
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tabId: tab.id,
              url: tab.url,
              screenshotBase64: (screenshot as any)?.data || '',
              dom: (dom as any)?.result?.value || '',
              console: consoleBuffer.read(tab.id, {
                limit: Math.max(1, Math.min(args.consoleLimit || 100, 500)),
              }),
              network: { active: Boolean(capture), requestCount: requests.length, requests },
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Diagnostic snapshot failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const diagnosticSnapshotTool = new DiagnosticSnapshotTool();
