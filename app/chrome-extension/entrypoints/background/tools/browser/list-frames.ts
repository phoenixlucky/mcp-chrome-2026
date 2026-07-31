import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';

class ListFramesTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.LIST_FRAMES;

  async execute(args: { tabId?: number }): Promise<ToolResult> {
    const tab =
      (typeof args?.tabId === 'number' ? await this.tryGetTab(args.tabId) : undefined) ??
      (await this.getActiveTabInWindow());
    if (!tab?.id) return createErrorResponse('Target tab not found.');
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
    return {
      content: [{ type: 'text', text: JSON.stringify({ tabId: tab.id, frames }) }],
      isError: false,
    };
  }
}

export const listFramesTool = new ListFramesTool();
