import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

interface BlockImagesParams {
  action: 'start' | 'stop';
  tabId?: number;
}

const OWNER = 'block-images';

class BlockImagesTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.BLOCK_IMAGES;
  private blockedTabs = new Set<number>();

  constructor() {
    super();
    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (
        method === 'Fetch.requestPaused' &&
        typeof source.tabId === 'number' &&
        this.blockedTabs.has(source.tabId)
      ) {
        void cdpSessionManager
          .sendCommand(source.tabId, 'Fetch.failRequest', {
            requestId: (params as { requestId?: string } | undefined)?.requestId,
            errorReason: 'BlockedByClient',
          })
          .catch((error) => console.warn('Failed to block image request:', error));
      }
    });
    chrome.debugger.onDetach.addListener(({ tabId }) => {
      if (typeof tabId === 'number') this.blockedTabs.delete(tabId);
    });
    chrome.tabs.onRemoved.addListener((tabId) => this.blockedTabs.delete(tabId));
  }

  async execute(args: BlockImagesParams): Promise<ToolResult> {
    if (args?.action !== 'start' && args?.action !== 'stop') {
      return createErrorResponse('Parameter [action] is required and must be one of: start, stop');
    }

    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : null) ??
      (await this.getActiveTabInWindow());
    if (!tab?.id) return createErrorResponse('Target tab not found');
    if (!/^https?:/i.test(tab.url || '')) {
      return createErrorResponse(
        `chrome_block_images requires an http(s) tab; got ${tab.url || 'an unknown URL'}. Pass the collector page tabId.`,
      );
    }
    const tabId = tab.id;

    if (args.action === 'start') return this.start(tabId);
    return this.stop(tabId);
  }

  private async start(tabId: number): Promise<ToolResult> {
    if (this.blockedTabs.has(tabId)) return this.result(tabId, true);

    await cdpSessionManager.attach(tabId, OWNER);
    try {
      await cdpSessionManager.sendCommand(tabId, 'Fetch.enable', {
        patterns: [{ resourceType: 'Image', requestStage: 'Request' }],
      });
      this.blockedTabs.add(tabId);
      return this.result(tabId, true);
    } catch (error) {
      await cdpSessionManager.detach(tabId, OWNER);
      throw error;
    }
  }

  private async stop(tabId: number): Promise<ToolResult> {
    if (!this.blockedTabs.delete(tabId)) return this.result(tabId, false);

    try {
      await cdpSessionManager.sendCommand(tabId, 'Fetch.disable');
    } finally {
      await cdpSessionManager.detach(tabId, OWNER);
    }
    return this.result(tabId, false);
  }

  private result(tabId: number, active: boolean): ToolResult {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tabId, blockImages: active }),
        },
      ],
      isError: false,
    };
  }
}

export const blockImagesTool = new BlockImagesTool();
