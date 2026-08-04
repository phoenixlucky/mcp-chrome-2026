import { type ToolResult } from '@/common/tool-handler';
import { rotateProxyForTab } from '@/entrypoints/background/proxy';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';

class ProxyRotateTool {
  name = TOOL_NAMES.BROWSER.PROXY_ROTATE;

  async execute(args: { tabId?: number; reason?: string }): Promise<ToolResult> {
    const reason = String(args.reason ?? '').trim();
    if (!reason) {
      return { content: [{ type: 'text', text: 'reason is required.' }], isError: true };
    }

    let tabId = args.tabId;
    if (tabId === undefined) {
      const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      tabId = active?.id;
    }
    if (!Number.isInteger(tabId) || (tabId as number) < 0) {
      return { content: [{ type: 'text', text: 'Active tab not found.' }], isError: true };
    }
    const resolvedTabId = tabId as number;

    try {
      return {
        content: [
          { type: 'text', text: JSON.stringify(await rotateProxyForTab(resolvedTabId, reason)) },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  }
}

export const proxyRotateTool = new ProxyRotateTool();
