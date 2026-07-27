/**
 * Output Sanitizer - 输出脱敏和限长工具
 *
 * 提供对 JavaScript 执行结果的安全处理：
 * 1. 敏感信息脱敏（cookie/token/password 等）
 * 2. 输出长度限制（默认 50KB）
 * 3. 深度对象序列化
 */

export const DEFAULT_MAX_OUTPUT_BYTES = 50 * 1024;

export interface OutputSanitizerOptions {
  maxBytes?: number;
  maxDepth?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  maxStringLength?: number;
}

export interface SanitizedOutput {
  text: string;
  truncated: boolean;
  redacted: boolean;
  originalBytes: number;
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_ARRAY_LENGTH = 200;
const DEFAULT_MAX_OBJECT_KEYS = 200;
const DEFAULT_MAX_STRING_LENGTH = 10_000;

// 敏感 key 标识符（会被脱敏）
// 参考 mcp-tools.js 的敏感 key 列表
const SENSITIVE_KEY_MARKERS = [
  'cookie',
  'setcookie',
  'authorization',
  'proxyauthorization',
  'bearer',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'password',
  'passwd',
  'pwd',
  'secret',
  'clientsecret',
  'apikey',
  'session',
  'sessionid',
  'sid',
  'csrf',
  'xsrf',
  // 补充 mcp-tools.js 中的敏感 key
  'credential',
  'privatekey',
  'accesskey',
  'auth',
  'oauth',
] as const;

/**
 * 对任意值进行脱敏和限长处理
 */
export function sanitizeAndLimitOutput(
  value: unknown,
  options: OutputSanitizerOptions = {},
): SanitizedOutput {
  const maxBytes = normalizePositiveInt(options.maxBytes, DEFAULT_MAX_OUTPUT_BYTES);
  const maxDepth = normalizePositiveInt(options.maxDepth, DEFAULT_MAX_DEPTH);
  const maxArrayLength = normalizePositiveInt(options.maxArrayLength, DEFAULT_MAX_ARRAY_LENGTH);
  const maxObjectKeys = normalizePositiveInt(options.maxObjectKeys, DEFAULT_MAX_OBJECT_KEYS);
  const maxStringLength = normalizePositiveInt(options.maxStringLength, DEFAULT_MAX_STRING_LENGTH);

  const { value: sanitizedValue, redacted } = sanitizeValue(value, {
    maxDepth,
    maxArrayLength,
    maxObjectKeys,
    maxStringLength,
  });

  const formatted = formatValueForOutput(sanitizedValue);
  const truncated = truncateTextBytes(formatted, maxBytes);

  return {
    text: truncated.text,
    truncated: truncated.truncated,
    redacted,
    originalBytes: truncated.originalBytes,
  };
}

/**
 * 对字符串进行敏感信息脱敏
 * 参考 mcp-tools.js 的脱敏逻辑，增加 Base64/Hex/cookie-query 识别
 */
export function sanitizeText(text: string): { text: string; redacted: boolean } {
  let out = text;
  let redacted = false;

  const replace = (
    re: RegExp,
    replacement: string | ((substring: string, ...args: string[]) => string),
  ) => {
    const next = out.replace(re, replacement as Parameters<typeof String.prototype.replace>[1]);
    if (next !== out) {
      out = next;
      redacted = true;
    }
  };

  // 1. 整体字符串检测（mcp-tools.js 风格）
  // Cookie/query string 形态检测（要求敏感 Cookie 键或连续参数，避免误伤普通正文）
  if (out.includes('=') && (out.includes(';') || out.includes('&'))) {
    // 检测 cookie 字符串
    if (looksLikeCookieString(out)) {
      return { text: '[BLOCKED: Cookie/query string data]', redacted: true };
    }
    // 检测 query string (key=value&key2=value2 形态)
    if (looksLikeQueryString(out)) {
      return { text: '[BLOCKED: Cookie/query string data]', redacted: true };
    }
  }

  // Base64 编码数据检测（20+ 字符的 Base64 字符串）
  if (/^[A-Za-z0-9+/]{20,}={0,2}$/.test(out)) {
    return { text: '[BLOCKED: Base64 encoded data]', redacted: true };
  }

  // Hex credential 检测（32+ 字符的纯十六进制）
  if (/^[a-f0-9]{32,}$/i.test(out)) {
    return { text: '[BLOCKED: Hex credential]', redacted: true };
  }

  // 2. Bearer token
  replace(/\bBearer\s+([A-Za-z0-9._~+/=-]+)\b/gi, 'Bearer <redacted>');

  // 3. JWT (三段式)
  replace(/\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '<redacted_jwt>');

  // 4. URL query 参数中的敏感值
  replace(
    /(^|[?&])(access_token|refresh_token|id_token|token|api_key|apikey|password|passwd|pwd|secret|session|sid|credential|auth|oauth)=([^&#\s]+)/gi,
    (_m, p1, p2) => `${p1}${p2}=<redacted>`,
  );

  // 5. Header-like 键值对
  replace(
    /\b(authorization|cookie|set-cookie|x-api-key|api_key|apikey|password|passwd|pwd|secret|token|access_token|refresh_token|id_token|session|sid|credential|private_key|oauth)\b\s*[:=]\s*([^\s,;"']+)/gi,
    (_m, key) => `${key}=<redacted>`,
  );

  // 6. 内嵌的 Base64 数据（在混合内容中）
  replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '<redacted_base64>');

  // 7. 内嵌的长 Hex 字符串（可能是 API key、hash 等）
  replace(/\b[a-f0-9]{40,}\b/gi, '<redacted_hex>');

  return { text: out, redacted };
}

/**
 * 检测字符串是否像连续的 query string (key=value&key2=value)
 */
function looksLikeQueryString(text: string): boolean {
  const s = (text || '').trim();
  return /(?:^|[?&])[A-Za-z][\w.-]*=[^&\s#]+(?:&[A-Za-z][\w.-]*=[^&\s#]+)+/.test(s);
}

function sanitizeValue(
  value: unknown,
  limits: {
    maxDepth: number;
    maxArrayLength: number;
    maxObjectKeys: number;
    maxStringLength: number;
  },
): { value: unknown; redacted: boolean } {
  const { maxDepth, maxArrayLength, maxObjectKeys, maxStringLength } = limits;
  const seen = new WeakMap<object, unknown>();
  let redacted = false;

  const walk = (v: unknown, depth: number): unknown => {
    if (depth < 0) return '[MaxDepth]';

    if (typeof v === 'string') {
      const sanitized = sanitizeText(v);
      if (sanitized.redacted) redacted = true;
      let s = sanitized.text;
      if (s.length > maxStringLength) {
        s = `${s.slice(0, maxStringLength)}... [truncated ${s.length - maxStringLength} chars]`;
      }
      return s;
    }

    if (
      v === null ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      typeof v === 'bigint' ||
      typeof v === 'undefined'
    ) {
      return v;
    }

    if (typeof v === 'symbol') return v.toString();
    if (typeof v === 'function') return `[Function${v.name ? `: ${v.name}` : ''}]`;

    if (typeof v !== 'object') return String(v);

    const obj = v as Record<string, unknown>;

    if (seen.has(obj)) return '[Circular]';

    if (Array.isArray(obj)) {
      const out: unknown[] = [];
      seen.set(obj, out);
      const len = Math.min(obj.length, maxArrayLength);
      for (let i = 0; i < len; i++) {
        out.push(walk(obj[i], depth - 1));
      }
      if (obj.length > maxArrayLength) out.push('[...truncated]');
      return out;
    }

    const out: Record<string, unknown> = {};
    seen.set(obj, out);

    const keys = Object.keys(obj);
    const len = Math.min(keys.length, maxObjectKeys);
    for (let i = 0; i < len; i++) {
      const key = keys[i];
      if (isSensitiveKey(key)) {
        out[key] = '<redacted>';
        redacted = true;
        continue;
      }
      out[key] = walk(obj[key], depth - 1);
    }
    if (keys.length > maxObjectKeys) out.__truncated__ = true;

    return out;
  };

  return { value: walk(value, maxDepth), redacted };
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_MARKERS.some((marker) => normalized.includes(marker));
}

function normalizeKey(key: string): string {
  return (key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 检测字符串是否像 cookie 字符串 (key=value; key2=value2)
 */
function looksLikeCookieString(text: string): boolean {
  const s = (text || '').trim();
  if (!s) return false;
  if (!s.includes('=') || !s.includes(';')) return false;

  const parts = s.split(';');
  if (parts.length < 2) return false;

  const keys = parts.map((part) => part.slice(0, part.indexOf('=')).trim()).filter(Boolean);
  return keys.length >= 2 && keys.some(isSensitiveKey);
}

function formatValueForOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';

  try {
    return safeJsonStringify(value);
  } catch {
    return String(value);
  }
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'bigint') return `${val.toString()}n`;
    if (typeof val === 'symbol') return val.toString();
    if (typeof val === 'function') return `[Function${val.name ? `: ${val.name}` : ''}]`;
    if (val && typeof val === 'object') {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

function truncateTextBytes(
  text: string,
  maxBytes: number,
): { text: string; truncated: boolean; originalBytes: number } {
  const originalBytes = byteLength(text);
  if (originalBytes <= maxBytes) {
    return { text, truncated: false, originalBytes };
  }

  const suffix = `\n... [truncated to ${maxBytes} bytes; original ${originalBytes} bytes]`;
  const suffixBytes = byteLength(suffix);
  const budget = Math.max(0, maxBytes - suffixBytes);

  // 二分查找合适的截断点
  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid);
    if (byteLength(candidate) <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  const prefix = text.slice(0, lo);
  return { text: prefix + suffix, truncated: true, originalBytes };
}

function byteLength(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, n);
}
