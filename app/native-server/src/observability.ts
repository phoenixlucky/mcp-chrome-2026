import { randomUUID } from 'node:crypto';

export interface RequestStageTimings {
  stdio_wait: number;
  http_process: number;
  native_queue_wait: number;
  native_roundtrip: number;
  browser_execution: number;
  total: number;
}

const SENSITIVE_KEY =
  /(?:authorization|cookie|token|secret|password|credential|content|html|body)/i;
const INLINE_SECRET =
  /((?:authorization|cookie|set-cookie|x-api-key|token|password)\s*[:=]\s*)([^\s,;]+)/gi;
const MAX_LOG_STRING = 256;

export function createTraceId(): string {
  return randomUUID();
}

/** Keep diagnostics useful without putting credentials or page data in stderr. */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[redacted]';
  if (typeof value === 'string') {
    if (/<\/?html|<!doctype|<script\b/i.test(value)) return '[redacted]';
    const safe = value.replace(INLINE_SECRET, '$1[redacted]');
    return safe.length > MAX_LOG_STRING ? `${safe.slice(0, MAX_LOG_STRING)}…` : safe;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactForLog(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[redacted]' : redactForLog(item, depth + 1),
    ]),
  );
}

export function structuredLog(event: string, fields: Record<string, unknown> = {}): void {
  // Native Messaging uses stdout for framed protocol messages; diagnostics go to stderr.
  process.stderr.write(
    `${JSON.stringify({ ts: new Date().toISOString(), event, ...(redactForLog(fields) as object) })}\n`,
  );
}
