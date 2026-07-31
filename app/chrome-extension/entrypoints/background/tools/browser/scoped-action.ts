import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';

interface ScopedActionParams {
  action: 'click' | 'extract' | 'paginate';
  scopeSelector: string;
  selector?: string;
  text?: string;
  role?: string;
  itemSelector?: string;
  nextSelector?: string;
  stopSelector?: string;
  maxPages?: number;
  timeout?: number;
  tabId?: number;
  frameId?: number;
}

class ScopedActionTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SCOPED_ACTION;

  async execute(args: ScopedActionParams): Promise<ToolResult> {
    if (!args?.scopeSelector || !['click', 'extract', 'paginate'].includes(args.action)) {
      return createErrorResponse('action and scopeSelector are required.');
    }
    if (args.action === 'paginate' && !args.nextSelector) {
      return createErrorResponse('nextSelector is required for paginate.');
    }
    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : undefined) ??
      (await this.getActiveTabInWindow());
    if (!tab?.id) return createErrorResponse('Target tab not found.');
    try {
      const injected = await chrome.scripting.executeScript({
        target: {
          tabId: tab.id,
          ...(typeof args.frameId === 'number' ? { frameIds: [args.frameId] } : {}),
        },
        args: [args],
        func: async (input: ScopedActionParams) => {
          const deepAll = (root: ParentNode, selector: string): Element[] => {
            const found = Array.from(root.querySelectorAll(selector));
            for (const host of Array.from(root.querySelectorAll('*'))) {
              if ((host as HTMLElement).shadowRoot)
                found.push(...deepAll((host as HTMLElement).shadowRoot!, selector));
            }
            return found;
          };
          const scope = deepAll(document, input.scopeSelector)[0];
          if (!scope) return { success: false, error: `Scope not found: ${input.scopeSelector}` };
          const matches = (selector?: string) => deepAll(scope, selector || '*');
          const target = matches(input.selector).find((element) => {
            const label =
              `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`.trim();
            return (
              (!input.text || label.includes(input.text)) &&
              (!input.role || element.getAttribute('role') === input.role)
            );
          });
          if (input.action === 'extract') {
            return {
              success: true,
              items: matches(input.selector || input.itemSelector).map((element) => ({
                text: (element.textContent || '').trim(),
                html: element.outerHTML,
              })),
            };
          }
          if (input.action === 'click') {
            if (!target) return { success: false, error: 'No scoped element matched.' };
            (target as HTMLElement).click();
            return { success: true, text: (target.textContent || '').trim() };
          }
          const pages: Array<Array<{ text: string; html: string }>> = [];
          const maxPages = Math.max(1, Math.min(input.maxPages || 50, 200));
          const timeout = Math.max(100, Math.min(input.timeout || 10000, 120000));
          for (let page = 0; page < maxPages; page += 1) {
            pages.push(
              matches(input.itemSelector || input.selector || '*').map((element) => ({
                text: (element.textContent || '').trim(),
                html: element.outerHTML,
              })),
            );
            if (input.stopSelector && deepAll(scope, input.stopSelector).length) break;
            const next = deepAll(scope, input.nextSelector || '')[0] as HTMLElement | undefined;
            if (
              !next ||
              next.matches('[disabled], [aria-disabled="true"]') ||
              next.getAttribute('aria-disabled') === 'true'
            )
              break;
            const before = scope.textContent || '';
            const changed = await new Promise<boolean>((resolve) => {
              const observer = new MutationObserver(() => {
                if ((scope.textContent || '') !== before) {
                  observer.disconnect();
                  resolve(true);
                }
              });
              observer.observe(scope, { childList: true, subtree: true, characterData: true });
              setTimeout(() => {
                observer.disconnect();
                resolve((scope.textContent || '') !== before);
              }, timeout);
              next.click();
            });
            if (!changed) break;
          }
          return { success: true, pages, pageCount: pages.length };
        },
      });
      const result = injected[0]?.result;
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: result?.success === false,
      };
    } catch (error) {
      return createErrorResponse(
        `Scoped action failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const scopedActionTool = new ScopedActionTool();
