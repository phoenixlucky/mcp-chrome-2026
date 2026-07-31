import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

type ResourceType = 'Image' | 'Font' | 'Media' | 'Script' | 'Stylesheet' | 'XHR' | 'Fetch';

interface BlockResourcesParams {
  action: 'start' | 'stop';
  tabId?: number;
  resourceTypes?: ResourceType[];
  urlPatterns?: string[];
}

const OWNER = 'block-resources';

class BlockResourcesTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.BLOCK_RESOURCES;
  private readonly rules = new Map<
    number,
    { resourceTypes: ResourceType[]; urlPatterns: string[] }
  >();

  constructor() {
    super();
    chrome.debugger.onEvent.addListener((source, method, params) => {
      const tabId = source.tabId;
      const rule = typeof tabId === 'number' ? this.rules.get(tabId) : undefined;
      if (method !== 'Fetch.requestPaused' || !rule || typeof tabId !== 'number') return;
      void cdpSessionManager
        .sendCommand(tabId, 'Fetch.failRequest', {
          requestId: (params as { requestId?: string })?.requestId,
          errorReason: 'BlockedByClient',
        })
        .catch(() => undefined);
    });
    chrome.debugger.onDetach.addListener(({ tabId }) => {
      if (typeof tabId === 'number') this.rules.delete(tabId);
    });
    chrome.tabs.onRemoved.addListener((tabId) => this.rules.delete(tabId));
  }

  async execute(args: BlockResourcesParams): Promise<ToolResult> {
    if (args?.action !== 'start' && args?.action !== 'stop') {
      return createErrorResponse('Parameter [action] must be start or stop.');
    }
    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : undefined) ??
      (await this.getActiveTabInWindow());
    if (!tab?.id || !/^https?:/i.test(tab.url || '')) {
      return createErrorResponse('An http(s) target tab is required.');
    }
    const tabId = tab.id;
    if (args.action === 'stop') {
      if (!this.rules.delete(tabId)) return this.result(tabId, false);
      try {
        await cdpSessionManager.sendCommand(tabId, 'Fetch.disable');
      } finally {
        await cdpSessionManager.detach(tabId, OWNER);
      }
      return this.result(tabId, false);
    }

    const resourceTypes: ResourceType[] = args.resourceTypes?.length
      ? args.resourceTypes
      : ['Image'];
    const urlPatterns = args.urlPatterns?.filter(Boolean) || [];
    await cdpSessionManager.attach(tabId, OWNER);
    try {
      await cdpSessionManager.sendCommand(tabId, 'Fetch.enable', {
        patterns: [
          ...resourceTypes.map((resourceType) => ({ resourceType, requestStage: 'Request' })),
          ...urlPatterns.map((urlPattern) => ({ urlPattern, requestStage: 'Request' })),
        ],
      });
      this.rules.set(tabId, { resourceTypes, urlPatterns });
      return this.result(tabId, true, resourceTypes, urlPatterns);
    } catch (error) {
      await cdpSessionManager.detach(tabId, OWNER);
      throw error;
    }
  }

  private result(
    tabId: number,
    active: boolean,
    resourceTypes: ResourceType[] = [],
    urlPatterns: string[] = [],
  ): ToolResult {
    return {
      content: [
        { type: 'text', text: JSON.stringify({ tabId, active, resourceTypes, urlPatterns }) },
      ],
      isError: false,
    };
  }
}

export const blockResourcesTool = new BlockResourcesTool();
