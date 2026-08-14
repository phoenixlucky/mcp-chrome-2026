/**
 * JavaScript Tool - CDP Runtime.evaluate with fallback
 *
 * Execute JavaScript in the browser tab and return the result.
 * - Primary: CDP Runtime.evaluate (supports awaitPromise + returnByValue)
 * - Fallback: chrome.scripting.executeScript (when debugger is busy)
 *
 * Features:
 * - Async code support (top-level await via async wrapper)
 * - Output sanitization (sensitive data redaction)
 * - Output truncation (configurable max bytes)
 * - Timeout handling
 * - Detailed error classification
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import {
  DEFAULT_MAX_OUTPUT_BYTES,
  sanitizeAndLimitOutput,
  sanitizeText,
} from '@/utils/output-sanitizer';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 15_000;
const CDP_SESSION_KEY = 'javascript';

// ============================================================================
// Types
// ============================================================================

type ExecutionEngine = 'cdp' | 'scripting';

type ErrorKind =
  | 'debugger_conflict'
  | 'timeout'
  | 'cancelled'
  | 'no_result'
  | 'syntax_error'
  | 'runtime_error'
  | 'cdp_error'
  | 'scripting_error';

interface JavaScriptToolParams {
  code: string;
  /** Backward-compatible alias; the public schema uses code. */
  script?: string;
  tabId?: number;
  windowId?: number;
  timeoutMs?: number;
  maxOutputBytes?: number;
  requireResult?: boolean;
}

interface ExecutionError {
  kind: ErrorKind;
  message: string;
  details?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

interface ExecutionMetrics {
  elapsedMs: number;
}

interface JavaScriptToolResult {
  success: boolean;
  tabId: number;
  url: string;
  engine: ExecutionEngine;
  returned: boolean;
  result?: string;
  truncated?: boolean;
  redacted?: boolean;
  warnings?: string[];
  error?: ExecutionError;
  metrics?: ExecutionMetrics;
}

interface ExecutionOptions {
  timeoutMs: number;
  maxOutputBytes: number;
}

// Discriminated union for execution results
type ExecutionSuccess = {
  ok: true;
  engine: ExecutionEngine;
  returned: boolean;
  output: string;
  truncated: boolean;
  redacted: boolean;
};

type ExecutionFailure = {
  ok: false;
  engine: ExecutionEngine;
  error: ExecutionError;
};

type ExecutionResult = ExecutionSuccess | ExecutionFailure;

// ============================================================================
// Timeout Error
// ============================================================================

class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Execution timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

class CancelledError extends Error {
  constructor() {
    super('Execution cancelled');
    this.name = 'CancelledError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const resolveOnce = (value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => rejectOnce(new CancelledError());
    const timer = setTimeout(() => rejectOnce(new TimeoutError(timeoutMs)), timeoutMs);

    if (signal?.aborted) {
      rejectOnce(new CancelledError());
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(resolveOnce, rejectOnce);
  });
}

function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof Error && error.name === 'TimeoutError';
}

function isCancelledError(error: unknown): error is CancelledError {
  return error instanceof Error && error.name === 'CancelledError';
}

function isDebuggerConflictError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Debugger is already attached|Another debugger is already attached|Cannot attach to this target/i.test(
    message,
  );
}

/**
 * Wrap user code in an async IIFE to support top-level await and return statements.
 */
function hasTopLevelReturn(code: string): boolean {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let quote = '';

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i + 2);
      i = end === -1 ? code.length : end;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 1;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === '{') brace++;
    else if (ch === '}') brace = Math.max(0, brace - 1);
    else if (paren === 0 && bracket === 0 && brace === 0 && /[A-Za-z_$]/.test(ch)) {
      const word = code.slice(i, i + 6);
      if (
        word === 'return' &&
        !/[A-Za-z0-9_$]/.test(code[i - 1] || '') &&
        !/[A-Za-z0-9_$]/.test(code[i + 6] || '')
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasTopLevelSemicolon(code: string): boolean {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let quote = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i + 2);
      i = end === -1 ? code.length : end;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 1;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === '{') brace++;
    else if (ch === '}') brace = Math.max(0, brace - 1);
    else if (ch === ';' && paren === 0 && bracket === 0 && brace === 0) return true;
  }
  return false;
}

/**
 * Execute code as an async function body while also accepting a final
 * expression such as `(function () { return 'x' })()`. The old contract only
 * returned values after an explicit top-level `return`, which made normal
 * expression/IIFE snippets unexpectedly report no_result.
 */
function wrapUserCode(code: string): string {
  const trimmed = code.trim();
  const expression = trimmed.replace(/;+\s*$/, '');
  const statementLike =
    /^(?:const|let|var|if|for|while|switch|try|throw|class|function|return|break|continue|debugger)\b/.test(
      expression,
    );
  const autoReturn =
    !hasTopLevelReturn(expression) && !hasTopLevelSemicolon(expression) && !statementLike;
  return autoReturn
    ? `(async () => {\nreturn (${expression});\n})()`
    : `(async () => {\n${code}\n})()`;
}

// ============================================================================
// CDP Execution
// ============================================================================

interface CDPRemoteObject {
  type?: string;
  subtype?: string;
  value?: unknown;
  unserializableValue?: string;
  description?: string;
}

interface CDPExceptionDetails {
  text?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  exception?: {
    className?: string;
    description?: string;
    value?: string;
  };
}

interface CDPEvaluateResult {
  result?: CDPRemoteObject;
  exceptionDetails?: CDPExceptionDetails;
}

function extractReturnValue(remoteObject?: CDPRemoteObject): unknown {
  if (!remoteObject) return undefined;

  if ('value' in remoteObject) return remoteObject.value;
  if ('unserializableValue' in remoteObject) return remoteObject.unserializableValue;
  if (typeof remoteObject.description === 'string') return remoteObject.description;

  return undefined;
}

function parseExceptionDetails(details: CDPExceptionDetails): ExecutionError {
  const exceptionClassName = details.exception?.className ?? '';
  const exceptionDescription = details.exception?.description ?? '';
  const exceptionValue = details.exception?.value ?? '';
  const text = details.text ?? '';

  // Determine the raw error message
  const rawMessage =
    exceptionDescription || exceptionValue || text || 'JavaScript execution failed';

  // Sanitize the message
  const message = sanitizeText(rawMessage).text;

  // Classify the error kind
  const isSyntaxError = exceptionClassName === 'SyntaxError' || /SyntaxError/i.test(rawMessage);

  return {
    kind: isSyntaxError ? 'syntax_error' : 'runtime_error',
    message,
    details: {
      url: details.url,
      lineNumber: details.lineNumber,
      columnNumber: details.columnNumber,
    },
  };
}

async function executeViaCdp(
  tabId: number,
  code: string,
  options: ExecutionOptions,
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  try {
    const expression = wrapUserCode(code);

    const response = await withTimeout(
      cdpSessionManager.withSession(tabId, CDP_SESSION_KEY, async () => {
        return (await cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
          // CDP 内置超时（毫秒），与外层 withTimeout 双重保障
          timeout: options.timeoutMs,
        })) as CDPEvaluateResult;
      }),
      // 外层超时稍长，给 CDP 一点余量处理超时响应
      options.timeoutMs + 1000,
      signal,
    );

    // Check for exception
    if (response?.exceptionDetails) {
      return {
        ok: false,
        engine: 'cdp',
        error: parseExceptionDetails(response.exceptionDetails),
      };
    }

    // Extract and sanitize the result
    const value = extractReturnValue(response?.result);
    const sanitized = sanitizeAndLimitOutput(value, { maxBytes: options.maxOutputBytes });

    return {
      ok: true,
      engine: 'cdp',
      returned: Boolean(response?.result && response.result.type !== 'undefined'),
      output: sanitized.text,
      truncated: sanitized.truncated,
      redacted: sanitized.redacted,
    };
  } catch (error) {
    if (isTimeoutError(error) || isCancelledError(error)) {
      // withTimeout() cannot cancel chrome.debugger.sendCommand(). Release
      // this tool's owner immediately so a pending Runtime.evaluate cannot
      // keep the tab's debugger session alive after the caller gave up.
      void cdpSessionManager.abortOwner(tabId, CDP_SESSION_KEY);
      return {
        ok: false,
        engine: 'cdp',
        error: {
          kind: isCancelledError(error) ? 'cancelled' : 'timeout',
          message: error.message,
        },
      };
    }

    if (isDebuggerConflictError(error)) {
      const message = sanitizeText(error instanceof Error ? error.message : String(error)).text;
      return {
        ok: false,
        engine: 'cdp',
        error: { kind: 'debugger_conflict', message },
      };
    }

    const message = sanitizeText(error instanceof Error ? error.message : String(error)).text;
    return {
      ok: false,
      engine: 'cdp',
      error: { kind: 'cdp_error', message },
    };
  }
}

// ============================================================================
// chrome.scripting.executeScript Fallback
// ============================================================================

interface ScriptingExecutionResult {
  ok: boolean;
  value?: unknown;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

async function executeViaScripting(
  tabId: number,
  code: string,
  options: ExecutionOptions,
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  const innerExecute = async (): Promise<ExecutionResult> => {
    const run = () =>
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',
        func: async (userCode: string): Promise<ScriptingExecutionResult> => {
          try {
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            const fn = new AsyncFunction(userCode);
            return { ok: true, value: await fn() };
          } catch (err: unknown) {
            const error = err as Error;
            return {
              ok: false,
              error: {
                name: error?.name,
                message: error?.message ?? String(err),
                stack: error?.stack,
              },
            };
          }
        },
        args: [wrapUserCode(code)],
      });
    let results = await run();
    if (!results?.some((frame) => Object.prototype.hasOwnProperty.call(frame, 'result'))) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      results = await run();
    }

    // Extract the first result
    const firstFrame = results?.[0];
    const result = (firstFrame as { result?: ScriptingExecutionResult })?.result;

    if (!result || typeof result !== 'object') {
      return {
        ok: false,
        engine: 'scripting',
        error: { kind: 'scripting_error', message: 'No result returned from executeScript' },
      };
    }

    if (!result.ok) {
      const rawMessage = result.error?.message ?? 'JavaScript execution failed';
      const rawStack = result.error?.stack;

      const message = sanitizeText(rawMessage).text;
      const sanitizedStack = rawStack ? sanitizeText(rawStack).text : undefined;

      const isSyntaxError = result.error?.name === 'SyntaxError' || /SyntaxError/i.test(rawMessage);

      return {
        ok: false,
        engine: 'scripting',
        error: {
          kind: isSyntaxError ? 'syntax_error' : 'runtime_error',
          message: sanitizedStack ? `${message}\n${sanitizedStack}` : message,
        },
      };
    }

    // Sanitize the successful result
    const sanitized = sanitizeAndLimitOutput(result.value, { maxBytes: options.maxOutputBytes });

    return {
      ok: true,
      engine: 'scripting',
      returned: result.value !== undefined,
      output: sanitized.text,
      truncated: sanitized.truncated,
      redacted: sanitized.redacted,
    };
  };

  try {
    return await withTimeout(innerExecute(), options.timeoutMs, signal);
  } catch (error) {
    if (isTimeoutError(error) || isCancelledError(error)) {
      return {
        ok: false,
        engine: 'scripting',
        error: {
          kind: isCancelledError(error) ? 'cancelled' : 'timeout',
          message: error.message,
        },
      };
    }

    const message = sanitizeText(error instanceof Error ? error.message : String(error)).text;
    return {
      ok: false,
      engine: 'scripting',
      error: { kind: 'scripting_error', message },
    };
  }
}

// ============================================================================
// Tool Implementation
// ============================================================================

class JavaScriptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.JAVASCRIPT;

  async execute(args: JavaScriptToolParams, signal?: AbortSignal): Promise<ToolResult> {
    const startTime = performance.now();

    try {
      // Validate required parameter
      const code =
        typeof args?.code === 'string'
          ? args.code.trim()
          : typeof args?.script === 'string'
            ? args.script.trim()
            : '';
      if (!code) {
        return createErrorResponse('Parameter [code] is required (legacy alias: script)');
      }

      // Resolve target tab. An explicit tabId is authoritative and must not
      // silently fall back to an unrelated active tab when it is stale.
      let tab: chrome.tabs.Tab;
      try {
        tab = await this.resolveTargetTab(args.tabId, args.windowId);
      } catch {
        return createErrorResponse(
          typeof args.tabId === 'number' ? `Tab not found: ${args.tabId}` : 'No active tab found',
        );
      }

      if (typeof tab.id !== 'number') {
        return createErrorResponse('Tab has no ID');
      }
      const tabId = tab.id;
      const url = tab.url ?? '';

      // Normalize options
      const options: ExecutionOptions = {
        timeoutMs: normalizePositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS),
        maxOutputBytes: normalizePositiveInt(args.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES),
      };

      const warnings: string[] = [];

      // Try CDP execution first
      const cdpResult = await executeViaCdp(tabId, code, options, signal);

      if (cdpResult.ok) {
        return args.requireResult && !cdpResult.returned
          ? this.buildNoResultResponse(tabId, url, cdpResult.engine, startTime)
          : this.buildSuccessResponse(tabId, url, cdpResult, startTime);
      }

      // If not a debugger conflict, return the CDP error
      if (cdpResult.error.kind !== 'debugger_conflict') {
        return this.buildErrorResponse(tabId, url, cdpResult, startTime);
      }

      // Debugger conflict - fallback to scripting API
      warnings.push(
        'Debugger is busy (DevTools or another extension attached). Falling back to chrome.scripting.executeScript (runs in ISOLATED world, not page context).',
      );

      const scriptingResult = await executeViaScripting(tabId, code, options, signal);

      if (scriptingResult.ok) {
        return args.requireResult && !scriptingResult.returned
          ? this.buildNoResultResponse(tabId, url, scriptingResult.engine, startTime, warnings)
          : this.buildSuccessResponse(tabId, url, scriptingResult, startTime, warnings);
      }

      return this.buildErrorResponse(tabId, url, scriptingResult, startTime, warnings);
    } catch (error) {
      console.error('JavaScriptTool.execute error:', error);
      return createErrorResponse(
        `JavaScript tool error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildSuccessResponse(
    tabId: number,
    url: string,
    result: ExecutionSuccess,
    startTime: number,
    warnings?: string[],
  ): ToolResult {
    const payload: JavaScriptToolResult = {
      success: true,
      tabId,
      url,
      engine: result.engine,
      returned: result.returned,
      result: result.returned ? result.output : undefined,
      truncated: result.truncated || undefined,
      redacted: result.redacted || undefined,
      warnings: warnings?.length ? warnings : undefined,
      metrics: { elapsedMs: Math.round(performance.now() - startTime) },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      isError: false,
    };
  }

  private buildErrorResponse(
    tabId: number,
    url: string,
    result: ExecutionFailure,
    startTime: number,
    warnings?: string[],
  ): ToolResult {
    const payload: JavaScriptToolResult = {
      success: false,
      tabId,
      url,
      engine: result.engine,
      returned: false,
      error: result.error,
      warnings: warnings?.length ? warnings : undefined,
      metrics: { elapsedMs: Math.round(performance.now() - startTime) },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      isError: true,
    };
  }

  private buildNoResultResponse(
    tabId: number,
    url: string,
    engine: ExecutionEngine,
    startTime: number,
    warnings?: string[],
  ): ToolResult {
    const payload: JavaScriptToolResult = {
      success: false,
      tabId,
      url,
      engine,
      returned: false,
      error: {
        kind: 'no_result',
        message: 'Script completed without returning a value. Add an explicit return statement.',
      },
      warnings: warnings?.length ? warnings : undefined,
      metrics: { elapsedMs: Math.round(performance.now() - startTime) },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      isError: true,
    };
  }
}

export const javascriptTool = new JavaScriptTool();
