/**
 * Extract Tool - chrome_extract
 *
 * Extract structured data from a web page using CSS selectors.
 * Injects a comprehensive JS extraction engine into the page context
 * via CDP Runtime.evaluate (MAIN world), supporting:
 *
 * - Multiple field extraction (text/html/outerHtml/attribute/number/href/src)
 * - Nested relative selectors per field
 * - Multiple mode (array results per field)
 * - Limit/offset pagination
 * - Context selector narrowing
 * - Automatic wait-for-selector before extraction
 *
 * Returns clean JSON: { items: [...], total, pageUrl }
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const CDP_SESSION_KEY = 'extract';

// ============================================================================
// Types
// ============================================================================

type ExtractFieldType =
  'text' | 'html' | 'outerHtml' | 'attribute' | 'number' | 'href' | 'src' | 'table';

interface ExtractField {
  name: string;
  selector?: string;
  type?: ExtractFieldType;
  attribute?: string;
  multiple?: boolean;
  defaultValue?: unknown;
}

interface ExtractToolParams {
  selector: string;
  fields: ExtractField[];
  contextSelector?: string;
  limit?: number;
  offset?: number;
  waitForSelector?: boolean;
  waitTimeout?: number;
  frameSelector?: string;
  tabId?: number;
  windowId?: number;
}

// ============================================================================
// Build the JS Extraction Engine
// ============================================================================

/**
 * Build the full extraction JS code injected into the page.
 * This generates a self-contained extraction function that runs in MAIN world.
 */
export function buildExtractionScript(params: ExtractToolParams): string {
  const { selector, fields, contextSelector, limit, offset, frameSelector } = params;

  // Serialize fields config for injection
  const fieldsJson = JSON.stringify(fields);

  // Build context expression
  const contextExpr = contextSelector
    ? `doc.querySelector(${JSON.stringify(contextSelector)})`
    : 'doc';
  const framePrelude = frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';

  // Build the extraction code
  return `
(() => {
  try {
    ${framePrelude}
    const selector = ${JSON.stringify(selector)};
    const fields = ${fieldsJson};
    const context = ${contextExpr};
    const limit = ${typeof limit === 'number' && limit > 0 ? limit : 'Infinity'};
    const offsetVal = ${typeof offset === 'number' && offset > 0 ? offset : 0};

    // Helper: extract value from element based on field config
    function extractField(el, field) {
      // Resolve target element
      let target = el;
      if (field.selector) {
        if (field.multiple) {
          // Multiple mode: return array of all matching elements
          return Array.from(target.querySelectorAll(field.selector)).map(sub => extractSingleValue(sub, field));
        } else {
          const found = target.querySelector(field.selector);
          if (!found) return field.defaultValue !== undefined ? field.defaultValue : null;
          target = found;
        }
      } else if (field.multiple) {
        // No sub-selector but multiple: treat parent itself as array of 1
        return [extractSingleValue(target, field)];
      }
      return extractSingleValue(target, field);
    }

    function extractSingleValue(el, field) {
      const type = field.type || 'text';
      try {
        switch (type) {
          case 'text':
            return (el.textContent || '').trim();
          case 'html':
            return el.innerHTML || '';
          case 'outerHtml':
            return el.outerHTML || '';
          case 'attribute':
            if (!field.attribute) return null;
            return el.getAttribute(field.attribute) || null;
          case 'number': {
            const raw = (el.textContent || '').trim();
            // Strip currency symbols, commas, whitespace
            const cleaned = raw.replace(/[^\\d.\\-]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? (field.defaultValue !== undefined ? field.defaultValue : null) : num;
          }
          case 'href':
            if (el.tagName === 'A') return el.href || null;
            // For non-anchors, read href attribute
            return el.getAttribute('href') || null;
          case 'src':
            return el.src || el.getAttribute('src') || null;
          case 'table':
            return extractTable(el);
          default:
            return (el.textContent || '').trim();
        }
      } catch (e) {
        return field.defaultValue !== undefined ? field.defaultValue : null;
      }
    }

    function extractTable(el) {
      const table = el.tagName === 'TABLE' ? el : el.querySelector('table');
      if (!table) return null;
      const rows = Array.from(table.querySelectorAll('tr')).filter(row => row.closest('table') === table);
      const grid = [];
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const values = grid[rowIndex] || (grid[rowIndex] = []);
        let column = 0;
        for (const cell of Array.from(row.querySelectorAll(':scope > th, :scope > td'))) {
          while (values[column] !== undefined) column++;
          const text = (cell.innerText || cell.textContent || '').replace(/\\s+/g, ' ').trim();
          const colSpan = Math.max(1, Number(cell.colSpan) || 1);
          const rowSpan = Math.max(1, Number(cell.rowSpan) || 1);
          for (let r = 0; r < rowSpan; r++) {
            const target = grid[rowIndex + r] || (grid[rowIndex + r] = []);
            for (let c = 0; c < colSpan; c++) target[column + c] = text;
          }
          column += colSpan;
        }
      }
      const headerRows = rows.filter(row => row.parentElement?.tagName === 'THEAD').length ||
        (rows[0] && rows[0].querySelector('th') ? 1 : 0);
      return {
        headers: headerRows > 0 ? grid[headerRows - 1] || [] : [],
        rows: grid.slice(headerRows),
      };
    }

    // Get parent element for querying
    const root = context || doc;

    // Wait briefly for elements (handled by caller's waitForSelector)
    const elements = root.querySelectorAll(selector);
    const total = elements.length;

    // Apply offset
    const start = Math.min(offsetVal, total);
    const end = limit === Infinity ? total : Math.min(start + limit, total);

    const items = [];
    for (let i = start; i < end; i++) {
      const el = elements[i];
      const item = {};
      for (const field of fields) {
        item[field.name] = extractField(el, field);
      }
      items.push(item);
    }

    return JSON.stringify({
      success: true,
      items: items,
      total: total,
      returned: items.length,
      pageUrl: win.location.href,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message || String(e) });
  }
})()`;
}

// ============================================================================
// Tool Implementation
// ============================================================================

class ExtractTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.EXTRACT;

  async execute(args: ExtractToolParams): Promise<ToolResult> {
    try {
      // 1. Validate required params
      if (!args.selector || !args.fields || args.fields.length === 0) {
        return createErrorResponse('Both "selector" and "fields" are required');
      }

      // 2. Resolve target tab
      let tabId: number;

      if (args.tabId) {
        const tab = await this.tryGetTab(args.tabId);
        if (!tab) {
          return createErrorResponse(`Tab ${args.tabId} not found`);
        }
        tabId = args.tabId;
      } else if (args.windowId) {
        const tab = await this.getActiveTabInWindow(args.windowId);
        if (!tab || !tab.id) {
          return createErrorResponse(`No active tab found in window ${args.windowId}`);
        }
        tabId = tab.id;
      } else {
        const tab = await this.getActiveTabOrThrow();
        tabId = tab.id!;
      }

      // 3. Optionally wait for selector to appear
      const shouldWait = args.waitForSelector !== false;
      const waitTimeout =
        typeof args.waitTimeout === 'number' ? args.waitTimeout : DEFAULT_WAIT_TIMEOUT_MS;

      if (shouldWait && args.selector) {
        const found = await this.waitForSelector(
          tabId,
          args.selector,
          waitTimeout,
          args.frameSelector,
        );
        if (!found) {
          // Return empty result instead of error
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  items: [],
                  total: 0,
                  returned: 0,
                  pageUrl: '',
                  warning: `Selector "${args.selector}" did not appear within ${waitTimeout}ms`,
                }),
              },
            ],
            isError: false,
          };
        }
      }

      // 4. Build and execute extraction JS via CDP
      const expression = buildExtractionScript(args);

      const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
        return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
          timeout: DEFAULT_TIMEOUT_MS,
        });
      });

      // 5. Handle CDP errors
      if (response?.exceptionDetails) {
        const msg = response.exceptionDetails.text || 'Extraction failed';
        return createErrorResponse(`Extraction failed: ${msg}`);
      }

      const rawValue = response?.result?.value;
      if (typeof rawValue !== 'string') {
        return createErrorResponse('Extraction returned unexpected result');
      }

      const result = JSON.parse(rawValue);

      if (!result.success) {
        return createErrorResponse(`Extraction failed: ${result.error}`);
      }

      // 6. Return structured data
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              items: result.items,
              total: result.total,
              returned: result.returned,
              pageUrl: result.pageUrl,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Extract failed: ${message}`);
    }
  }

  /**
   * Wait for a CSS selector to appear in the DOM.
   * Uses the same pattern as chrome_wait (present mode).
   */
  private async waitForSelector(
    tabId: number,
    selector: string,
    timeoutMs: number,
    frameSelector?: string,
  ): Promise<boolean> {
    const startedAt = Date.now();
    const pollInterval = 200;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const response = await cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
          return cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
            expression: `(() => {
            const frame = ${frameSelector ? `document.querySelector(${JSON.stringify(frameSelector)})` : 'null'};
            if (${frameSelector ? '!frame' : 'false'}) throw new Error('Iframe not found');
            const doc = frame ? frame.contentDocument : document;
            if (!doc) throw new Error('Iframe is cross-origin or unavailable');
            return doc.querySelector(${JSON.stringify(selector)}) !== null;
          })()`,
            returnByValue: true,
            awaitPromise: true,
            timeout: 3000,
          });
        });

        if (response?.result?.value === true) {
          return true;
        }
      } catch {
        // Ignore errors during polling
      }

      const remaining = timeoutMs - (Date.now() - startedAt);
      if (remaining <= 0) break;

      await new Promise((resolve) => setTimeout(resolve, Math.min(pollInterval, remaining)));
    }

    return false;
  }
}

export const extractTool = new ExtractTool();
