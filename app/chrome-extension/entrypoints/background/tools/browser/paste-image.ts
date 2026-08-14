import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { prepareFileFromRemote } from './file-preparation';

interface PasteImageParams {
  selector?: string;
  targetSelector?: string;
  filePath?: string;
  fileUrl?: string;
  base64Data?: string;
  fileName?: string;
  tabId?: number;
  windowId?: number;
}

const CDP_SESSION_KEY = 'paste-image';

/**
 * Paste an image file through the page's paste event path. CDP key events
 * cannot access the OS clipboard, so this intentionally avoids Ctrl+V.
 */
class PasteImageTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.PASTE_IMAGE;

  async execute(args: PasteImageParams): Promise<ToolResult> {
    const sourceCount = [args?.filePath, args?.fileUrl, args?.base64Data].filter(Boolean).length;
    if (sourceCount !== 1) {
      return createErrorResponse('Provide exactly one of filePath, fileUrl, or base64Data');
    }

    try {
      const explicit = await this.tryGetTab(args.tabId);
      const tab = explicit || (await this.getActiveTabOrThrowInWindow(args.windowId));
      if (!tab.id) return createErrorResponse('Target tab has no ID');
      const tabId = tab.id;
      const filePath =
        args.filePath ||
        (await prepareFileFromRemote({
          fileUrl: args.fileUrl,
          base64Data: args.base64Data,
          fileName: args.fileName || 'pasted-image.png',
        }));
      if (!filePath) return createErrorResponse('Failed to prepare image file');

      const inputId = `__mcp_paste_image_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const selector = args.targetSelector?.trim() || args.selector?.trim() || '';

      const result = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
        const evaluate = async (expression: string) =>
          cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
          });

        try {
          const created = await evaluate(`(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = ${JSON.stringify(inputId)};
            input.hidden = true;
            document.documentElement.appendChild(input);
            return true;
          })()`);
          if (created?.exceptionDetails || created?.result?.value !== true)
            throw new Error('Could not create temporary file input');

          await cdpSessionManager.sendCommand(tabId, 'DOM.enable', {});
          const { root } = await cdpSessionManager.sendCommand(tabId, 'DOM.getDocument', {
            depth: -1,
            pierce: true,
          });
          const { nodeId } = await cdpSessionManager.sendCommand(tabId, 'DOM.querySelector', {
            nodeId: root.nodeId,
            selector: `#${inputId}`,
          });
          if (!nodeId) throw new Error('Temporary file input was not found');
          await cdpSessionManager.sendCommand(tabId, 'DOM.setFileInputFiles', {
            nodeId,
            files: [filePath],
          });

          const pasted = await evaluate(`(() => {
            const input = document.getElementById(${JSON.stringify(inputId)});
            const target = ${
              selector
                ? `document.querySelector(${JSON.stringify(selector)})`
                : `(() => {
                    const active = document.activeElement;
                    if (active && (active.matches?.('textarea,input,[contenteditable="true"]') || active.isContentEditable)) return active;
                    return document.querySelector('textarea,input:not([type="file"]),[contenteditable="true"]');
                  })()`
            };
            const file = input?.files?.[0];
            if (!input || !file) return { success: false, error: 'Image file was not loaded' };
            if (!target) return { success: false, error: 'Paste target was not found' };
            try { target.focus?.({ preventScroll: true }); } catch (_) { target.focus?.(); }
            const data = new DataTransfer();
            data.items.add(file);
            const event = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: data,
            });
            const dispatched = target.dispatchEvent(event);
            return {
              success: true,
              dispatched,
              defaultPrevented: event.defaultPrevented,
              target: { tagName: target.tagName, id: target.id || '', className: target.className || '' },
              file: { name: file.name, type: file.type, size: file.size },
            };
          })()`);

          if (pasted?.exceptionDetails) throw new Error('Paste event dispatch failed');
          const payload = pasted?.result?.value;
          if (!payload?.success) throw new Error(payload?.error || 'Image paste failed');
          return payload;
        } finally {
          await evaluate(`document.getElementById(${JSON.stringify(inputId)})?.remove()`);
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Image paste event dispatched',
              ...result,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Image paste failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const pasteImageTool = new PasteImageTool();
