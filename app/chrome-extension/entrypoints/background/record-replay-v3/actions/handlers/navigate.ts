/**
 * Navigate Action Handler
 *
 * Handles page navigation actions:
 * - Navigate to URL
 * - Page refresh
 * - Wait for navigation completion
 */

import { handleCallTool } from '@/entrypoints/background/tools';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { failed, invalid, ok } from '../registry';
import type { ActionHandler } from '../types';
import { resolveString } from './common';

export const navigateHandler: ActionHandler<'navigate'> = {
  type: 'navigate',

  validate: (action) => {
    const hasRefresh = action.params.refresh === true;
    const hasUrl = action.params.url !== undefined;
    return hasRefresh || hasUrl ? ok() : invalid('Missing url or refresh parameter');
  },

  describe: (action) => {
    if (action.params.refresh) return 'Refresh page';
    const url = typeof action.params.url === 'string' ? action.params.url : '(dynamic)';
    return `Navigate to ${url}`;
  },

  run: async (ctx, action) => {
    const vars = ctx.vars;
    const tabId = ctx.tabId;
    if (typeof tabId !== 'number') {
      return failed('TAB_NOT_FOUND', 'No active tab found');
    }

    // Handle page refresh
    if (action.params.refresh) {
      const result = await handleCallTool({
        name: TOOL_NAMES.BROWSER.NAVIGATE,
        args: { refresh: true, tabId },
      });

      if ((result as { isError?: boolean })?.isError) {
        const errorContent = (result as { content?: Array<{ text?: string }> })?.content;
        const errorMsg = errorContent?.[0]?.text || 'Page refresh failed';
        return failed('NAVIGATION_FAILED', errorMsg);
      }

      return { status: 'success' };
    }

    // Handle URL navigation
    const urlResolved = resolveString(action.params.url, vars);
    if (!urlResolved.ok) {
      return failed('VALIDATION_ERROR', urlResolved.error);
    }

    const url = urlResolved.value.trim();
    if (!url) {
      return failed('VALIDATION_ERROR', 'URL is empty');
    }

    const result = await handleCallTool({
      name: TOOL_NAMES.BROWSER.NAVIGATE,
      args: { url, tabId },
    });

    if ((result as { isError?: boolean })?.isError) {
      const errorContent = (result as { content?: Array<{ text?: string }> })?.content;
      const errorMsg = errorContent?.[0]?.text || `Navigation to ${url} failed`;
      return failed('NAVIGATION_FAILED', errorMsg);
    }

    return { status: 'success' };
  },
};
