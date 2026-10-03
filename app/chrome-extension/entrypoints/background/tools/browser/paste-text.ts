/**
 * Paste Text Tool - synthesizes a ClipboardEvent('paste') to paste multi-paragraph
 * text into rich text editors
 *
 * Built to work around automated input problems in Draft.js-based editors (Zhihu, Medium, etc.):
 * - chrome_computer type / CDP Input.insertText: only works right after a page refresh when the
 *   editor is clean; text with line breaks gets scrambled and overwrites content
 * - execCommand('insertText'): only the last paragraph is kept in a multi-paragraph draft
 * - Clipboard API: rejected by Chrome when the page has no focus
 *
 * How it works: in the page's MAIN world, construct a synthetic ClipboardEvent('paste') carrying
 * a DataTransfer and dispatch it to the editor so the editor takes its native paste path --
 * Draft.js parses the full text into multiple content blocks.
 * The synthetic event only builds a DataTransfer and never reads the system clipboard,
 * so it is not restricted by page focus.
 *
 * Execution engines (same as javascriptTool):
 * - Primary: CDP Runtime.evaluate (MAIN world, page context)
 * - fallback: chrome.scripting.executeScript + world: 'MAIN' (when the debugger is busy)
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

const CDP_SESSION_KEY = 'paste-text';

/** Settle time (ms) after pasting to let Draft.js parse the clipboard content into content blocks */
const SETTLE_MS = 80;

const DEBUGGER_CONFLICT_RE =
  /Debugger is already attached|Another debugger is already attached|Cannot attach to this target/i;

interface PasteTextParams {
  /** Text to paste; may contain line breaks/blank lines (blank lines become separate paragraphs in Draft.js) */
  text: string;
  /** CSS selector of the editor element; auto-detects [contenteditable="true"] when omitted */
  selector?: string;
  tabId?: number;
  windowId?: number;
}

type Engine = 'cdp' | 'scripting';

interface PageResult {
  ok: boolean;
  error?: string;
  dispatched?: boolean;
  editor?: string;
  length?: number;
  blockCount?: number;
}

type EvalOutcome =
  | { ok: true; value: PageResult }
  | { ok: false; engine: Engine; error: string; debuggerConflict?: boolean };

/**
 * Build the paste code that runs in the page's MAIN world. text/selector are embedded as JSON strings to avoid injection.
 */
function buildPasteScript(text: string, selector: string): string {
  const payload = JSON.stringify({ text, selector });
  return `(async () => {
    const { text, selector } = ${payload};
    const pickEditor = () => {
      if (selector) {
        const el = document.querySelector(selector);
        if (el) return el;
      }
      const editable = Array.from(document.querySelectorAll('[contenteditable="true"]'));
      return editable.find((el) => el.isContentEditable) || editable[0] || null;
    };
    const editor = pickEditor();
    if (!editor) {
      return { ok: false, error: 'No editable element found (pass a selector to target the editor)' };
    }
    if (typeof editor.focus === 'function') {
      try { editor.focus(); } catch { /* a failed focus must not block the paste */ }
    }
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const dispatched = editor.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
      composed: true,
    }));
    await new Promise((resolve) => setTimeout(resolve, ${SETTLE_MS}));
    const content = editor.textContent || '';
    const draftBlocks = editor.querySelectorAll('.DraftEditor-block');
    const blockCount = draftBlocks.length > 0 ? draftBlocks.length : editor.children.length;
    const cls = typeof editor.className === 'string' && editor.className.trim()
      ? '.' + String(editor.className).trim().split(/\\s+/)[0]
      : '';
    return {
      ok: true,
      dispatched,
      editor: editor.tagName + cls,
      length: content.length,
      blockCount,
    };
  })()`;
}

interface CDPEvaluateResponse {
  result?: { value?: PageResult };
  exceptionDetails?: { exception?: { description?: string }; text?: string };
}

async function executeViaCdp(tabId: number, code: string): Promise<EvalOutcome> {
  try {
    const response = await cdpSessionManager.withSession<CDPEvaluateResponse>(
      tabId,
      CDP_SESSION_KEY,
      async () => {
        return cdpSessionManager.sendCommand<CDPEvaluateResponse>(tabId, 'Runtime.evaluate', {
          expression: code,
          returnByValue: true,
          awaitPromise: true,
          timeout: 10_000,
        });
      },
    );

    if (response?.exceptionDetails) {
      const raw =
        response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text ||
        'Paste script failed';
      return { ok: false, engine: 'cdp', error: String(raw) };
    }
    return {
      ok: true,
      value: response?.result?.value ?? { ok: false, error: 'No result returned' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      engine: 'cdp',
      error: message,
      debuggerConflict: DEBUGGER_CONFLICT_RE.test(message),
    };
  }
}

async function executeViaScripting(tabId: number, code: string): Promise<EvalOutcome> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (userCode: string): Promise<PageResult> => {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AsyncFunction(userCode) as () => Promise<PageResult>;
        return await fn();
      },
      args: [code],
    });
    const value = results?.[0]?.result;
    if (!value)
      return { ok: false, engine: 'scripting', error: 'No result returned from executeScript' };
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      engine: 'scripting',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

class PasteTextTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.PASTE_TEXT;

  async execute(args: PasteTextParams): Promise<ToolResult> {
    const text = typeof args?.text === 'string' ? args.text : '';
    if (!text) {
      return createErrorResponse('Parameter [text] is required');
    }

    const tab =
      (typeof args?.tabId === 'number' ? await this.tryGetTab(args.tabId) : undefined) ??
      (await this.getActiveTabInWindow(args.windowId));
    if (!tab?.id) {
      return createErrorResponse('No active tab found');
    }

    const selector =
      typeof args?.selector === 'string' && args.selector.trim() ? args.selector.trim() : '';
    const code = buildPasteScript(text, selector);

    const cdp = await executeViaCdp(tab.id, code);
    if (cdp.ok) {
      return this.buildResponse(tab.id, tab.url ?? '', 'cdp', cdp.value);
    }

    if (cdp.debuggerConflict) {
      const scripting = await executeViaScripting(tab.id, code);
      if (scripting.ok) {
        return this.buildResponse(tab.id, tab.url ?? '', 'scripting', scripting.value);
      }
      return createErrorResponse(
        `Paste failed (CDP busy, scripting fallback too): ${scripting.error}`,
      );
    }

    return createErrorResponse(`Paste failed: ${cdp.error}`);
  }

  private buildResponse(tabId: number, url: string, engine: Engine, value: PageResult): ToolResult {
    const payload = { tabId, url, engine, ...value };
    if (value.ok === false) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, ...payload }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, ...payload }) }],
      isError: false,
    };
  }
}

export const pasteTextTool = new PasteTextTool();
