/**
 * Get Tab URL Tool - chrome_get_tab_url
 *
 * Retrieves the current URL and metadata for a browser tab.
 * Lightweight alternative to get_windows_and_tabs when only
 * the current URL is needed.
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';

// ============================================================================
// Types
// ============================================================================

interface GetTabUrlParams {
  tabId?: number;
  windowId?: number;
}

// ============================================================================
// Implementation
// ============================================================================

class GetTabUrlTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_TAB_URL;

  async execute(args: GetTabUrlParams): Promise<ToolResult> {
    try {
      // 1. Resolve target tab
      let tab: chrome.tabs.Tab | null = null;

      if (args.tabId) {
        tab = await this.tryGetTab(args.tabId);
        if (!tab) {
          return createErrorResponse(`Tab ${args.tabId} not found`);
        }
      } else if (args.windowId) {
        tab = await this.getActiveTabInWindow(args.windowId);
        if (!tab) {
          return createErrorResponse(`No active tab found in window ${args.windowId}`);
        }
      } else {
        tab = await this.getActiveTabOrThrow();
      }

      const tabId = tab.id;
      if (typeof tabId !== 'number') {
        return createErrorResponse('Tab has no valid ID');
      }

      // 2. Return tab info
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              url: tab.url || '',
              title: tab.title || '',
              tabId,
              windowId: tab.windowId,
              favIconUrl: tab.favIconUrl || '',
              status: tab.status || 'unknown',
              active: tab.active ?? false,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Failed to get tab URL: ${message}`);
    }
  }
}

export const getTabUrlTool = new GetTabUrlTool();
