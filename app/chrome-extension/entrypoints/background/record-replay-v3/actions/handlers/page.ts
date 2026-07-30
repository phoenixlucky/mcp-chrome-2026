import { handleCallTool } from '@/entrypoints/background/tools';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { failed, invalid, ok } from '../registry';
import type { ActionHandler, JsonValue } from '../types';
import { resolveString } from './common';

function readToolResult(
  result: unknown,
): { ok: true; value: JsonValue } | { ok: false; error: string } {
  const text = (result as { content?: Array<{ type?: string; text?: string }> })?.content?.find(
    (item) => item?.type === 'text' && typeof item.text === 'string',
  )?.text;
  if ((result as { isError?: boolean })?.isError || !text)
    return { ok: false, error: text || '页面工具执行失败' };
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch {
    return { ok: false, error: '页面工具返回了无效数据' };
  }
}

function validSaveAs(saveAs: unknown) {
  return typeof saveAs === 'string' && saveAs.trim().length > 0;
}

export const getTabUrlHandler: ActionHandler<'getTabUrl'> = {
  type: 'getTabUrl',
  validate: (action) => {
    const { tabId, saveAs } = action.params;
    if (tabId !== undefined && (!Number.isInteger(tabId) || tabId < 0))
      return invalid('标签页 ID 必须为非负整数');
    return validSaveAs(saveAs) ? ok() : invalid('需填写保存变量名');
  },
  describe: (action) => `获取标签信息 → ${action.params.saveAs || 'tabInfo'}`,
  run: async (ctx, action) => {
    try {
      const tab = await chrome.tabs.get(action.params.tabId || ctx.tabId);
      const value = { url: tab.url || '', title: tab.title || '' };
      ctx.vars[action.params.saveAs!] = value;
      return { status: 'success', output: value };
    } catch (error) {
      return failed('TAB_NOT_FOUND', error instanceof Error ? error.message : String(error));
    }
  },
};

export const readPageHandler: ActionHandler<'readPage'> = {
  type: 'readPage',
  validate: (action) => {
    const { depth, saveAs } = action.params;
    if (depth !== undefined && (!Number.isInteger(depth) || depth < 0))
      return invalid('最大深度必须为非负整数');
    return validSaveAs(saveAs) ? ok() : invalid('需填写保存变量名');
  },
  describe: (action) => `获取页面元素 → ${action.params.saveAs || 'page'}`,
  run: async (ctx, action) => {
    const result = readToolResult(
      await handleCallTool({
        name: TOOL_NAMES.BROWSER.READ_PAGE,
        args: {
          tabId: ctx.tabId,
          filter: action.params.filter || 'interactive',
          depth: action.params.depth,
        },
      }),
    );
    if (!result.ok) return failed('SCRIPT_FAILED', result.error);
    ctx.vars[action.params.saveAs!] = result.value;
    return { status: 'success', output: { page: result.value } };
  },
};

export const getWebContentHandler: ActionHandler<'getWebContent'> = {
  type: 'getWebContent',
  validate: (action) => (validSaveAs(action.params.saveAs) ? ok() : invalid('需填写保存变量名')),
  describe: (action) => `获取网页内容 → ${action.params.saveAs || 'content'}`,
  run: async (ctx, action) => {
    let selector: string | undefined;
    if (action.params.selector !== undefined) {
      const resolved = resolveString(action.params.selector, ctx.vars);
      if (!resolved.ok) return failed('VALIDATION_ERROR', resolved.error);
      selector = resolved.value.trim() || undefined;
    }
    const result = readToolResult(
      await handleCallTool({
        name: TOOL_NAMES.BROWSER.WEB_FETCHER,
        args: {
          tabId: ctx.tabId,
          htmlContent: action.params.htmlContent === true,
          textContent: action.params.htmlContent ? false : action.params.textContent !== false,
          selector,
        },
      }),
    );
    if (!result.ok) return failed('SCRIPT_FAILED', result.error);
    ctx.vars[action.params.saveAs!] = result.value;
    return { status: 'success', output: { content: result.value } };
  },
};
