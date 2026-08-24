import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { BaseBrowserToolExecutor, getNonInjectablePageReason } from '../base-browser';

type Target = { tabId?: number; windowId?: number };
type SelectorType = 'css' | 'xpath';

const PAGE_SIZES_INCHES: Record<string, [number, number]> = {
  A3: [11.6929, 16.5354],
  A4: [8.2677, 11.6929],
  A5: [5.8268, 8.2677],
  LETTER: [8.5, 11],
  LEGAL: [8.5, 14],
  TABLOID: [11, 17],
};

function json(value: unknown, isError = false): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], isError };
}

function selectorCode(selector: string, selectorType: SelectorType): string {
  const value = JSON.stringify(selector);
  if (selectorType === 'xpath') {
    return `document.evaluate(${value}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
  }
  return `document.querySelector(${value})`;
}

function selectorArgs(args: { selector?: unknown; selectorType?: unknown }): {
  selector: string;
  selectorType: SelectorType;
} | null {
  if (typeof args.selector !== 'string' || !args.selector.trim()) return null;
  const selectorType = args.selectorType === 'xpath' ? 'xpath' : 'css';
  return { selector: args.selector, selectorType };
}

async function evaluatePage<T>(tabId: number, expression: string): Promise<T> {
  const response = await cdpSessionManager.withSession(tabId, 'page-tools', () =>
    cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }),
  );
  if (response?.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text ||
        'Page evaluation failed',
    );
  }
  return response?.result?.value as T;
}

function storageArea(value: unknown): 'localStorage' | 'sessionStorage' {
  const area = String(value ?? 'local').toLowerCase();
  if (area === 'session' || area === 'sessionstorage') return 'sessionStorage';
  return 'localStorage';
}

function storageString(value: unknown): string {
  if (typeof value === 'string') return value;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('value must be JSON serializable');
  return serialized;
}

class CreateTabTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.CREATE_TAB;

  async execute(
    args: Target & { url?: string; active?: boolean; background?: boolean; pinned?: boolean } = {},
  ): Promise<ToolResult> {
    if (args.url !== undefined && typeof args.url !== 'string') {
      return createErrorResponse('url must be a string');
    }
    const active =
      typeof args.active === 'boolean'
        ? args.active
        : typeof args.background === 'boolean'
          ? !args.background
          : true;
    const tab = await chrome.tabs.create({
      ...(args.url ? { url: args.url } : {}),
      ...(typeof args.windowId === 'number' ? { windowId: args.windowId } : {}),
      active,
      pinned: args.pinned === true,
    });
    return json({
      success: true,
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      active: tab.active,
      pinned: tab.pinned,
    });
  }
}

class HoverTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.HOVER;

  async execute(
    args: Target & { selector?: string; selectorType?: SelectorType; durationMs?: number } = {},
  ): Promise<ToolResult> {
    const target = selectorArgs(args);
    if (!target) return createErrorResponse('selector is required');
    const tab = await this.resolveTargetTab(args.tabId, args.windowId);
    if (typeof tab.id !== 'number') return createErrorResponse('Target tab not found');

    try {
      const point = await evaluatePage<
        { found: false; error?: string } | { found: true; x: number; y: number; tagName: string }
      >(
        tab.id,
        `(() => {
          let element;
          try { element = ${selectorCode(target.selector, target.selectorType)}; }
          catch (error) { return { found: false, error: String(error?.message || error) }; }
          if (!(element instanceof Element)) return { found: false, error: 'Element not found' };
          element.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) return { found: false, error: 'Element is not visible' };
          return { found: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, tagName: element.tagName };
        })()`,
      );
      if (!point?.found) return createErrorResponse(point?.error || 'Element not found');

      await cdpSessionManager.withSession(tab.id, 'page-tools', () =>
        cdpSessionManager.sendCommand(tab.id!, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: point.x,
          y: point.y,
          button: 'none',
        }),
      );
      const durationMs =
        typeof args.durationMs === 'number' && Number.isFinite(args.durationMs)
          ? Math.min(Math.max(args.durationMs, 0), 10_000)
          : 250;
      if (durationMs > 0) await new Promise((resolve) => setTimeout(resolve, durationMs));
      return json({
        success: true,
        tabId: tab.id,
        selector: target.selector,
        selectorType: target.selectorType,
        tagName: point.tagName,
        x: point.x,
        y: point.y,
        durationMs,
      });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }
}

class ElementInfoTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_ELEMENT_INFO;

  async execute(
    args: Target & { selector?: string; selectorType?: SelectorType } = {},
  ): Promise<ToolResult> {
    const target = selectorArgs(args);
    if (!target) return createErrorResponse('selector is required');
    const tab = await this.resolveTargetTab(args.tabId, args.windowId);
    if (typeof tab.id !== 'number') return createErrorResponse('Target tab not found');

    try {
      const info = await evaluatePage<Record<string, unknown>>(
        tab.id,
        `(() => {
          let element;
          try { element = ${selectorCode(target.selector, target.selectorType)}; }
          catch (error) { return { found: false, error: String(error?.message || error) }; }
          if (!(element instanceof Element)) return { found: false, error: 'Element not found' };
          const rect = element.getBoundingClientRect();
          const styles = getComputedStyle(element);
          const computedStyles = Object.fromEntries(Array.from(styles, name => [name, styles.getPropertyValue(name)]));
          const attributes = Object.fromEntries(Array.from(element.attributes, attribute => [attribute.name, attribute.value]));
          return {
            found: true,
            tagName: element.tagName.toLowerCase(),
            attributes,
            computedStyles,
            boundingRect: {
              x: rect.x, y: rect.y, top: rect.top, right: rect.right,
              bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height,
            },
            text: (element.textContent || '').trim(),
          };
        })()`,
      );
      if (!info?.found) return createErrorResponse(String(info?.error || 'Element not found'));
      return json({
        success: true,
        tabId: tab.id,
        selector: target.selector,
        selectorType: target.selectorType,
        ...info,
      });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }
}

class StorageTool extends BaseBrowserToolExecutor {
  constructor(
    public readonly name: string,
    private readonly action: 'get' | 'set' | 'delete',
  ) {
    super();
  }

  async execute(
    args: Target & {
      storageArea?: string;
      storage?: string;
      area?: string;
      key?: string;
      keys?: string[];
      value?: unknown;
      items?: Record<string, unknown>;
    } = {},
  ): Promise<ToolResult> {
    const area = storageArea(args.storageArea ?? args.storage ?? args.area);
    const keys = args.keys ?? (typeof args.key === 'string' ? [args.key] : undefined);
    if (keys && (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string' || !key))) {
      return createErrorResponse('keys must contain non-empty strings');
    }
    if (this.action === 'set' && args.items === undefined && typeof args.key !== 'string') {
      return createErrorResponse('key and value or items are required');
    }
    if (this.action === 'delete' && (!keys || keys.length === 0)) {
      return createErrorResponse('key or keys is required');
    }

    const tab = await this.resolveTargetTab(args.tabId, args.windowId);
    if (typeof tab.id !== 'number') return createErrorResponse('Target tab not found');
    const restricted = getNonInjectablePageReason(tab.url);
    if (restricted) return createErrorResponse(restricted);

    try {
      let payload: Record<string, string> | undefined;
      if (this.action === 'set') {
        const items = args.items ?? { [args.key as string]: args.value };
        if (!items || typeof items !== 'object' || Array.isArray(items)) {
          return createErrorResponse('items must be an object');
        }
        payload = Object.fromEntries(
          Object.entries(items).map(([key, value]) => [key, storageString(value)]),
        );
      }
      const expression = `(() => {
        const area = ${area};
        const keys = ${JSON.stringify(keys ?? null)};
        const items = ${JSON.stringify(payload ?? null)};
        if (${JSON.stringify(this.action)} === 'get') {
          const result = {};
          (keys || Array.from({ length: area.length }, (_, index) => area.key(index))).forEach(key => {
            if (key !== null) result[key] = area.getItem(key);
          });
          return { storageArea: ${JSON.stringify(area)}, items: result };
        }
        if (${JSON.stringify(this.action)} === 'set') {
          Object.entries(items || {}).forEach(([key, value]) => area.setItem(key, value));
          return { storageArea: ${JSON.stringify(area)}, items };
        }
        const deleted = keys || [];
        deleted.forEach(key => area.removeItem(key));
        return { storageArea: ${JSON.stringify(area)}, deleted };
      })()`;
      const value = await evaluatePage<Record<string, unknown>>(tab.id, expression);
      return json({ success: true, tabId: tab.id, ...(value || {}) });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }
}

class PrintToPdfTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.PRINT_TO_PDF;

  async execute(
    args: Target & {
      pageSize?: string;
      paperSize?: string;
      paperWidth?: number;
      paperHeight?: number;
      width?: number;
      height?: number;
      landscape?: boolean;
      printBackground?: boolean;
      preferCSSPageSize?: boolean;
      scale?: number;
      marginTop?: number;
      marginBottom?: number;
      marginLeft?: number;
      marginRight?: number;
      pageRanges?: string;
      displayHeaderFooter?: boolean;
      headerTemplate?: string;
      footerTemplate?: string;
      savePdf?: boolean;
      filename?: string;
    } = {},
  ): Promise<ToolResult> {
    const tab = await this.resolveTargetTab(args.tabId, args.windowId);
    if (typeof tab.id !== 'number') return createErrorResponse('Target tab not found');

    const requestedSize = String(args.pageSize ?? args.paperSize ?? '').trim();
    const customWidth = args.paperWidth ?? args.width;
    const customHeight = args.paperHeight ?? args.height;
    if ((customWidth !== undefined) !== (customHeight !== undefined)) {
      return createErrorResponse('paperWidth and paperHeight must be provided together');
    }
    if (
      customWidth !== undefined &&
      (!Number.isFinite(customWidth) ||
        !Number.isFinite(customHeight) ||
        customWidth <= 0 ||
        customHeight! <= 0)
    ) {
      return createErrorResponse('paperWidth and paperHeight must be positive inches');
    }
    const sizeKey = requestedSize.toUpperCase();
    const namedSize = PAGE_SIZES_INCHES[sizeKey];
    if (
      requestedSize &&
      requestedSize.toLowerCase() !== 'page' &&
      !namedSize &&
      sizeKey !== 'CUSTOM'
    ) {
      return createErrorResponse(
        'Unsupported pageSize; use page, A3, A4, A5, Letter, Legal, Tabloid, or custom',
      );
    }
    if (sizeKey === 'CUSTOM' && (customWidth === undefined || customHeight === undefined)) {
      return createErrorResponse('Custom pageSize requires paperWidth and paperHeight');
    }

    const params: Record<string, unknown> = {
      landscape: args.landscape === true,
      printBackground: args.printBackground !== false,
      preferCSSPageSize: args.preferCSSPageSize === true || requestedSize.toLowerCase() === 'page',
    };
    const dimensions =
      namedSize || (customWidth !== undefined ? [customWidth, customHeight!] : undefined);
    if (dimensions && !params.preferCSSPageSize) {
      params.paperWidth = dimensions[0];
      params.paperHeight = dimensions[1];
    }
    for (const name of ['scale', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight']) {
      const value = args[name as keyof typeof args];
      if (value !== undefined) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          return createErrorResponse(`${name} must be a non-negative number`);
        }
        params[name] = value;
      }
    }
    for (const name of ['pageRanges', 'headerTemplate', 'footerTemplate']) {
      const value = args[name as keyof typeof args];
      if (value !== undefined) params[name] = value;
    }
    if (args.displayHeaderFooter !== undefined)
      params.displayHeaderFooter = args.displayHeaderFooter === true;

    try {
      const result = await cdpSessionManager.withSession(tab.id, 'print-to-pdf', () =>
        cdpSessionManager.sendCommand<{ data?: string }>(tab.id!, 'Page.printToPDF', params),
      );
      if (!result?.data) throw new Error('CDP Page.printToPDF returned empty data');
      const response: Record<string, unknown> = {
        success: true,
        tabId: tab.id,
        mimeType: 'application/pdf',
        base64Data: result.data,
        pageSize: requestedSize || undefined,
      };
      if (args.savePdf === true) {
        const filename =
          (args.filename || `page_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`)
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\.pdf$/i, '') + '.pdf';
        const downloadId = await chrome.downloads.download({
          url: `data:application/pdf;base64,${result.data}`,
          filename,
          saveAs: false,
        });
        response.downloadId = downloadId;
        response.filename = filename;
      }
      return json(response);
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }
}

export const createTabTool = new CreateTabTool();
export const hoverTool = new HoverTool();
export const elementInfoTool = new ElementInfoTool();
export const storageGetTool = new StorageTool(TOOL_NAMES.BROWSER.STORAGE_GET, 'get');
export const storageSetTool = new StorageTool(TOOL_NAMES.BROWSER.STORAGE_SET, 'set');
export const storageDeleteTool = new StorageTool(TOOL_NAMES.BROWSER.STORAGE_DELETE, 'delete');
export const printToPdfTool = new PrintToPdfTool();
