import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared-2026';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';

interface PageTextParams {
  selector?: string;
  tabId?: number;
  windowId?: number;
}

class PageTextTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_PAGE_TEXT;

  async execute(args: PageTextParams): Promise<ToolResult> {
    try {
      const tab =
        (await this.tryGetTab(args.tabId)) ||
        (await this.getActiveTabOrThrowInWindow(args.windowId));
      if (!tab.id) return createErrorResponse('Active tab has no ID');

      await this.injectContentScript(tab.id, ['inject-scripts/web-fetcher-helper.js']);
      const response = await this.sendMessageToTab(tab.id, {
        action: TOOL_MESSAGE_TYPES.WEB_FETCHER_GET_TEXT_CONTENT,
        selector: args.selector,
      });
      if (!response?.success)
        return createErrorResponse(response?.error || 'Failed to extract page text');

      const article = response.article || {};
      const textContent = String(response.textContent || '');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: article.title || tab.title || '',
              textContent,
              content: article.content || '',
              excerpt: article.excerpt || '',
              byline: article.byline || '',
              siteName: article.siteName || '',
              length: textContent.length,
              lang: article.lang || '',
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Failed to extract page text: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const pageTextTool = new PageTextTool();
