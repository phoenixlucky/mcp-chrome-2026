import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

interface FormValueParams {
  selector: string;
  tabId?: number;
  windowId?: number;
}

const CDP_SESSION_KEY = 'form-value';

class FormValueTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_FORM_VALUE;

  async execute(args: FormValueParams): Promise<ToolResult> {
    if (!args?.selector?.trim()) return createErrorResponse('selector is required');

    try {
      const explicit = await this.tryGetTab(args.tabId);
      const tab = explicit || (await this.getActiveTabOrThrowInWindow(args.windowId));
      if (!tab.id) return createErrorResponse('Target tab has no ID');
      const response = await cdpSessionManager.withSession(tab.id, CDP_SESSION_KEY, () =>
        cdpSessionManager.sendCommand(tab.id!, 'Runtime.evaluate', {
          expression: `(() => {
            const element = document.querySelector(${JSON.stringify(args.selector)});
            if (!element) return { success: false, error: 'Element not found' };
            const hasValue = 'value' in element;
            return {
              success: true,
              selector: ${JSON.stringify(args.selector)},
              value: hasValue ? String(element.value ?? '') : String(element.innerText ?? element.textContent ?? ''),
              tagName: element.tagName,
              type: element.type || null,
              focused: document.activeElement === element,
            };
          })()`,
          returnByValue: true,
          awaitPromise: true,
        }),
      );
      const payload = response?.result?.value;
      if (!payload?.success) return createErrorResponse(payload?.error || 'Element not found');
      return { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false };
    } catch (error) {
      return createErrorResponse(
        `Form value read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const formValueTool = new FormValueTool();
