import { ToolExecutor } from '@/common/tool-handler';
import type { ToolProgressReporter, ToolResult } from '@/common/tool-handler';
import { TIMEOUTS, ERROR_MESSAGES } from '@/common/constants';

const PING_TIMEOUT_MS = 300;

const NON_INJECTABLE_PROTOCOLS = new Set([
  'chrome-error:',
  'chrome:',
  'edge:',
  'devtools:',
  'view-source:',
]);

/** Return a user-facing reason when Chrome will reject script injection. */
export function getNonInjectablePageReason(url?: string): string | null {
  const protocol = /^([a-z][a-z\d+.-]*:)/i.exec(url?.trim() || '')?.[1]?.toLowerCase();
  if (!protocol || !NON_INJECTABLE_PROTOCOLS.has(protocol)) return null;
  return `Tab is not script-injectable because it is on a restricted page (${protocol})`;
}

/**
 * Base class for browser tool executors
 */
export abstract class BaseBrowserToolExecutor implements ToolExecutor {
  abstract name: string;
  abstract execute(
    args: any,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult>;

  /**
   * Inject content script into tab
   */
  protected async injectContentScript(
    tabId: number,
    files: string[],
    injectImmediately = false,
    world: 'MAIN' | 'ISOLATED' = 'ISOLATED',
    allFrames: boolean = false,
    frameIds?: number[],
  ): Promise<void> {
    console.log(`Injecting ${files.join(', ')} into tab ${tabId}`);

    let tabUrl: string | undefined;
    try {
      tabUrl = (await chrome.tabs.get(tabId)).url;
    } catch {
      // Let the actual injection call report a closed/missing tab.
    }
    const nonInjectableReason = getNonInjectablePageReason(tabUrl);
    if (nonInjectableReason) {
      const message = `Cannot inject ${files.join(', ')} into tab ${tabId}: ${nonInjectableReason}`;
      console.warn(message);
      throw new Error(`${ERROR_MESSAGES.TOOL_EXECUTION_FAILED}: ${message}`);
    }

    const isAccessibilityHelper =
      files.length === 1 && files[0] === 'inject-scripts/accessibility-tree-helper.js';
    const pingAction = isAccessibilityHelper
      ? 'accessibility_tree_helper_ping'
      : `${this.name}_ping`;

    // An all-frame injection must reach every frame; a top-frame pong is not enough.
    if (!allFrames)
      try {
        const pingFrameId = frameIds?.[0];
        const response = await Promise.race([
          typeof pingFrameId === 'number'
            ? chrome.tabs.sendMessage(tabId, { action: pingAction }, { frameId: pingFrameId })
            : chrome.tabs.sendMessage(tabId, { action: pingAction }, { frameId: 0 }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`${this.name} Ping action to tab ${tabId} timed out`)),
              PING_TIMEOUT_MS,
            ),
          ),
        ]);

        if (response && response.status === 'pong') {
          console.log(
            `pong received for action '${this.name}' in tab ${tabId}. Assuming script is active.`,
          );
          return;
        } else {
          console.warn(`Unexpected ping response in tab ${tabId}:`, response);
        }
      } catch (error) {
        console.debug(
          `ping content script failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

    try {
      const target: { tabId: number; allFrames?: boolean; frameIds?: number[] } = { tabId };
      if (frameIds && frameIds.length > 0) {
        target.frameIds = frameIds;
      } else if (allFrames) {
        target.allFrames = true;
      }
      await chrome.scripting.executeScript({
        target,
        files,
        injectImmediately,
        world,
      } as any);
      console.log(`'${files.join(', ')}' injection successful for tab ${tabId}`);
    } catch (injectionError) {
      const errorMessage =
        injectionError instanceof Error ? injectionError.message : String(injectionError);
      console.error(
        `Content script '${files.join(', ')}' injection failed for tab ${tabId}: ${errorMessage}`,
      );
      throw new Error(
        `${ERROR_MESSAGES.TOOL_EXECUTION_FAILED}: Failed to inject content script in tab ${tabId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Send message to tab
   */
  protected async sendMessageToTab(tabId: number, message: any, frameId?: number): Promise<any> {
    try {
      const response =
        typeof frameId === 'number'
          ? await chrome.tabs.sendMessage(tabId, message, { frameId })
          : await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });

      if (response && response.error) {
        throw new Error(String(response.error));
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Error sending message to tab ${tabId} for action ${message?.action || 'unknown'}: ${errorMessage}`,
      );

      if (error instanceof Error) {
        throw error;
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Try to get an existing tab by id. Returns null when not found.
   */
  protected async tryGetTab(tabId?: number): Promise<chrome.tabs.Tab | null> {
    if (typeof tabId !== 'number') return null;
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      return null;
    }
  }

  /**
   * Resolve the tab targeted by a browser tool.
   *
   * An explicit tabId is authoritative: a closed/missing tab must be reported
   * instead of silently falling back to an unrelated active tab.
   */
  protected async resolveTargetTab(tabId?: number, windowId?: number): Promise<chrome.tabs.Tab> {
    if (typeof tabId === 'number') {
      const explicit = await this.tryGetTab(tabId);
      if (!explicit || typeof explicit.id !== 'number') {
        throw new Error(`Target tab ${tabId} not found`);
      }
      return explicit;
    }

    const active = await this.getActiveTabInWindow(windowId);
    if (!active || typeof active.id !== 'number') {
      throw new Error(
        typeof windowId === 'number'
          ? `Active tab not found in window ${windowId}`
          : 'Active tab not found',
      );
    }
    return active;
  }

  /**
   * Wait until Chrome reports that a tab has left the loading state.
   */
  protected async waitForTabReady(tabId: number, timeoutMs = 15_000): Promise<chrome.tabs.Tab> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let lastTab: chrome.tabs.Tab | null = null;

    while (Date.now() <= deadline) {
      try {
        lastTab = await chrome.tabs.get(tabId);
        if (lastTab.status !== 'loading') return lastTab;
      } catch {
        throw new Error(`Target tab ${tabId} was closed during navigation`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (lastTab) return lastTab;
    throw new Error(`Timed out waiting for tab ${tabId} to load`);
  }

  /**
   * Get the active tab in the current window. Throws when not found.
   */
  protected async getActiveTabOrThrow(): Promise<chrome.tabs.Tab> {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!active || typeof active.id !== 'number') throw new Error('Active tab not found');
    return active;
  }

  /**
   * Optionally focus window and/or activate tab. Defaults preserve current behavior
   * when caller sets activate/focus flags explicitly.
   */
  protected async ensureFocus(
    tab: chrome.tabs.Tab,
    options: { activate?: boolean; focusWindow?: boolean } = {},
  ): Promise<void> {
    const activate = options.activate === true;
    const focusWindow = options.focusWindow === true;
    if (focusWindow && typeof tab.windowId === 'number') {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    if (activate && typeof tab.id === 'number') {
      await chrome.tabs.update(tab.id, { active: true });
    }
  }

  /**
   * Get the active tab. When windowId provided, search within that window; otherwise currentWindow.
   */
  protected async getActiveTabInWindow(windowId?: number): Promise<chrome.tabs.Tab | null> {
    if (typeof windowId === 'number') {
      const tabs = await chrome.tabs.query({ active: true, windowId });
      return tabs && tabs[0] ? tabs[0] : null;
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs[0] ? tabs[0] : null;
  }

  /**
   * Same as getActiveTabInWindow, but throws if not found.
   */
  protected async getActiveTabOrThrowInWindow(windowId?: number): Promise<chrome.tabs.Tab> {
    const tab = await this.getActiveTabInWindow(windowId);
    if (!tab || typeof tab.id !== 'number') throw new Error('Active tab not found');
    return tab;
  }
}
