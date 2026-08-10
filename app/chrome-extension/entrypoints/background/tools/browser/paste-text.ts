/**
 * Paste Text Tool - 合成 ClipboardEvent('paste') 粘贴多段文本到富文本编辑器
 *
 * 专治 Draft.js 系编辑器（知乎、Medium 等）的自动化输入问题：
 * - chrome_computer type / CDP Input.insertText：仅页面刚刷新、编辑器干净时有效，文本带换行会错乱覆盖
 * - execCommand('insertText')：多段文本草稿只保存最后一段
 * - 剪贴板 API：页面无焦点时被 Chrome 拒绝
 *
 * 原理：在页面 MAIN world 构造带 DataTransfer 的合成 ClipboardEvent('paste') 并派发到编辑器，
 * 让编辑器走原生 paste 路径 —— Draft.js 会把全部文本完整解析为多个 content blocks。
 * 合成事件只构造 DataTransfer，不读取系统剪贴板，因此不受页面焦点限制。
 *
 * 执行引擎（与 javascriptTool 一致）：
 * - 主路径：CDP Runtime.evaluate（MAIN world，页面上下文）
 * - fallback：chrome.scripting.executeScript + world: 'MAIN'（调试器被占用时）
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { cdpSessionManager } from '@/utils/cdp-session-manager';

const CDP_SESSION_KEY = 'paste-text';

/** 粘贴后等待 Draft.js 把剪贴板内容解析为 content blocks 的静置时间（毫秒） */
const SETTLE_MS = 80;

const DEBUGGER_CONFLICT_RE =
  /Debugger is already attached|Another debugger is already attached|Cannot attach to this target/i;

interface PasteTextParams {
  /** 要粘贴的文本，可含换行/空行（空行会被 Draft.js 拆成独立段落） */
  text: string;
  /** 编辑器元素 CSS 选择器；缺省自动探测 [contenteditable="true"] */
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
 * 构建在页面 MAIN world 执行的粘贴代码。text/selector 以 JSON 字符串嵌入，避免注入。
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
      try { editor.focus(); } catch { /* focus 失败不阻塞粘贴 */ }
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
