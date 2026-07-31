import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { BaseBrowserToolExecutor } from '../base-browser';

type ToolMetadata = { intent?: unknown; background?: boolean };
type CookieFilter = Pick<chrome.cookies.GetAllDetails, 'url' | 'domain' | 'name' | 'storeId'> &
  ToolMetadata;
type CookieSetArgs = chrome.cookies.SetDetails & ToolMetadata;
type CookieDeleteArgs = chrome.cookies.CookieDetails & ToolMetadata;

const SAME_SITE_VALUES = new Set<chrome.cookies.SameSiteStatus>([
  'no_restriction',
  'lax',
  'strict',
  'unspecified',
]);

function validCookieUrl(url: unknown): url is string {
  try {
    const protocol = new URL(String(url)).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function withoutToolMetadata<T extends ToolMetadata>(args: T): Omit<T, keyof ToolMetadata> {
  const { intent: _intent, background: _background, ...details } = args;
  return details;
}

function serializeCookie(cookie: chrome.cookies.Cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    session: cookie.session,
    expirationDate: cookie.expirationDate,
    storeId: cookie.storeId,
    hostOnly: cookie.hostOnly,
  };
}

class CookieGetTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.COOKIE_GET;

  async execute(args: CookieFilter = {}): Promise<ToolResult> {
    if (args.url && !validCookieUrl(args.url)) {
      return createErrorResponse('url must be an http or https URL');
    }
    const cookies = await chrome.cookies.getAll(withoutToolMetadata(args));
    return {
      content: [{ type: 'text', text: JSON.stringify({ cookies: cookies.map(serializeCookie) }) }],
      isError: false,
    };
  }
}

class CookieSetTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.COOKIE_SET;

  async execute(args: CookieSetArgs): Promise<ToolResult> {
    if (!validCookieUrl(args.url)) return createErrorResponse('url must be an http or https URL');
    if (!args.name) return createErrorResponse('name is required');
    if (typeof args.value !== 'string') return createErrorResponse('value must be a string');
    if (args.sameSite && !SAME_SITE_VALUES.has(args.sameSite)) {
      return createErrorResponse('sameSite must be no_restriction, lax, strict, or unspecified');
    }
    if (
      args.expirationDate !== undefined &&
      (!Number.isFinite(args.expirationDate) || args.expirationDate <= 0)
    ) {
      return createErrorResponse('expirationDate must be a positive Unix timestamp in seconds');
    }
    const hostname = new URL(args.url).hostname;
    const domain = args.domain?.replace(/^\./, '');
    if (domain && hostname !== domain && !hostname.endsWith(`.${domain}`)) {
      return createErrorResponse('domain must match the URL host');
    }
    if (args.secure && new URL(args.url).protocol !== 'https:') {
      return createErrorResponse('secure cookies require an https URL');
    }

    const cookie = await chrome.cookies.set(withoutToolMetadata(args));
    if (!cookie) return createErrorResponse('Chrome did not return the saved cookie');
    return {
      content: [{ type: 'text', text: JSON.stringify({ cookie: serializeCookie(cookie) }) }],
      isError: false,
    };
  }
}

class CookieDeleteTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.COOKIE_DELETE;

  async execute(args: CookieDeleteArgs): Promise<ToolResult> {
    if (!validCookieUrl(args.url)) return createErrorResponse('url must be an http or https URL');
    if (!args.name) return createErrorResponse('name is required');
    const removed = await chrome.cookies.remove(withoutToolMetadata(args));
    return {
      content: [
        { type: 'text', text: JSON.stringify({ deleted: !!removed, details: removed ?? null }) },
      ],
      isError: false,
    };
  }
}

export const cookieGetTool = new CookieGetTool();
export const cookieSetTool = new CookieSetTool();
export const cookieDeleteTool = new CookieDeleteTool();
