import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';

const DEFAULT_NETWORK_REQUEST_TIMEOUT = 30000; // For sending a single request via content script

const FORBIDDEN_REQUEST_HEADERS =
  /^(accept-charset|accept-encoding|access-control-request-|connection|content-length|cookie2?|date|dnt|expect|host|keep-alive|origin|proxy-|sec-|te|trailer|transfer-encoding|upgrade|via)$/i;

function browserSafeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !FORBIDDEN_REQUEST_HEADERS.test(name)),
  );
}

function isSameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

async function readResponse(response: Response) {
  const responseData: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: unknown;
  } = {
    status: response.status,
    statusText: response.statusText,
    headers: {},
  };

  response.headers.forEach((value, key) => {
    responseData.headers[key] = value;
  });

  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      responseData.body = await response.json();
    } else if (
      contentType.includes('text/') ||
      contentType.includes('application/xml') ||
      contentType.includes('application/javascript')
    ) {
      responseData.body = await response.text();
    } else {
      responseData.body = '[Binary data not displayed]';
    }
  } catch (error) {
    responseData.body = `[Error parsing response body: ${error instanceof Error ? error.message : String(error)}]`;
  }

  return responseData;
}

async function requestFromExtension(args: NetworkRequestToolParams) {
  const method = (args.method || 'GET').toUpperCase();
  const timeout = Number.isFinite(args.timeout)
    ? Math.max(0, args.timeout!)
    : DEFAULT_NETWORK_REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(args.url, {
      method,
      headers: browserSafeHeaders(args.headers || {}),
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow',
      ...(method !== 'GET' && method !== 'HEAD' && args.body !== undefined
        ? { body: typeof args.body === 'string' ? args.body : JSON.stringify(args.body) }
        : {}),
      signal: controller.signal,
    });

    return { success: true, response: await readResponse(response) };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `Request timed out after ${timeout}ms`
        : error instanceof Error
          ? error.message || error.name
          : String(error);
    return {
      success: false,
      error: `Network request failed for ${args.url}: ${message || 'Failed to fetch'}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

interface NetworkRequestToolParams {
  url: string; // URL is always required
  method?: string; // Defaults to GET
  headers?: Record<string, string>; // User-provided headers
  body?: any; // User-provided body
  timeout?: number; // Timeout for the network request itself
  // Optional multipart/form-data descriptor. When provided, overrides body and lets the helper build FormData.
  // Shape: { fields?: Record<string, string|number|boolean>, files?: Array<{ name: string, fileUrl?: string, filePath?: string, base64Data?: string, filename?: string, contentType?: string }> }
  // Or a compact array: [ [name, fileSpec, filename?], ... ] where fileSpec can be 'url:...', 'file:/abs/path', 'base64:...'
  formData?: any;
}

/**
 * NetworkRequestTool - Sends network requests based on provided parameters.
 */
class NetworkRequestTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NETWORK_REQUEST;

  async execute(args: NetworkRequestToolParams): Promise<ToolResult> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = DEFAULT_NETWORK_REQUEST_TIMEOUT,
    } = args;

    console.log(`NetworkRequestTool: Executing with options:`, args);

    if (!url) {
      return createErrorResponse('URL parameter is required.');
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        return createErrorResponse('No active tab found or tab has no ID.');
      }
      if (!/^https?:\/\//i.test(activeTab.url ?? '')) {
        return createErrorResponse(
          '当前标签是 Chrome 内置页，不能注入网络请求脚本。请先打开任意 http(s) 网页；代理出口检测请使用 chrome_proxy_diagnostics。',
        );
      }
      const activeTabId = activeTab.id;

      // Page fetches are useful for same-origin requests and file-backed
      // multipart bodies because they retain the page context. Cross-origin
      // requests must use the extension context or the page's CORS policy
      // turns a valid request into the opaque "Failed to fetch" error.
      if (!args.formData && !isSameOrigin(url, activeTab.url || '')) {
        const resultFromExtension = await requestFromExtension({
          ...args,
          method: method.toUpperCase(),
          headers: browserSafeHeaders(headers),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(resultFromExtension) }],
          isError: !resultFromExtension.success,
        };
      }

      // Ensure content script is available in the target tab
      await this.injectContentScript(activeTabId, ['inject-scripts/network-helper.js']);

      console.log(
        `NetworkRequestTool: Sending to content script: URL=${url}, Method=${method}, Headers=${Object.keys(headers).join(',')}, BodyType=${typeof body}`,
      );

      const resultFromContentScript = await this.sendMessageToTab(activeTabId, {
        action: TOOL_MESSAGE_TYPES.NETWORK_SEND_REQUEST,
        url: url,
        method: method.toUpperCase(),
        headers: browserSafeHeaders(headers),
        body: body,
        formData: args.formData || null,
        timeout: timeout,
      });

      console.log(`NetworkRequestTool: Response from content script:`, resultFromContentScript);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(resultFromContentScript),
          },
        ],
        isError: !resultFromContentScript?.success,
      };
    } catch (error: any) {
      console.error('NetworkRequestTool: Error sending network request:', error);
      return createErrorResponse(
        `Error sending network request: ${error.message || String(error)}`,
      );
    }
  }
}

export const networkRequestTool = new NetworkRequestTool();
