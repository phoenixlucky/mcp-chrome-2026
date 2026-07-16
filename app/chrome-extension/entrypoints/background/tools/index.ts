import { createErrorResponse } from '@/common/tool-handler';
import { ERROR_MESSAGES } from '@/common/constants';
import * as browserTools from './browser';
import { flowRunTool, listPublishedFlowsTool } from './record-replay';

const tools = { ...browserTools, flowRunTool, listPublishedFlowsTool } as any;
const toolsMap = new Map(Object.values(tools).map((tool: any) => [tool.name, tool]));

/**
 * Tool call parameter interface
 */
export interface ToolCallParam {
  name: string;
  args: any;
}

const WRITE_TOOL = /(?:navigate|click|scroll|fill|keyboard|key|dialog|computer|upload)/;

async function showOperation(param: ToolCallParam, state: '执行中' | '完成' | '失败') {
  const tabId = param.args?.tabId;
  const tab =
    typeof tabId === 'number'
      ? await chrome.tabs.get(tabId)
      : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.id) return;

  await chrome.scripting
    .executeScript({
      target: {
        tabId: tab.id,
        ...(typeof param.args?.frameId === 'number' ? { frameIds: [param.args.frameId] } : {}),
      },
      args: [
        param.name,
        param.args?.selector ?? null,
        param.args?.ref ?? null,
        param.args?.coordinates ?? null,
        state,
      ],
      func: (name, selector, ref, coordinates, state) => {
        const statusId = '__mcp_operation_status__';
        const highlightId = '__mcp_operation_highlight__';
        const root = document.documentElement || document.body;
        let status = document.getElementById(statusId);
        if (!status) {
          status = document.createElement('div');
          status.id = statusId;
          Object.assign(status.style, {
            position: 'fixed',
            left: '16px',
            bottom: '16px',
            zIndex: '2147483647',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(17, 24, 39, .9)',
            color: '#fff',
            font: '13px/1.4 system-ui, sans-serif',
            pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,.25)',
          });
          root.append(status);
        }
        const actionLabels: Record<string, string> = {
          chrome_scroll: '滚动',
          chrome_click: '点击',
          chrome_click_and_wait: '点击',
          chrome_fill: '输入',
        };
        status.textContent = `${state}：${actionLabels[name] || String(name).replace(/^chrome_/, '')}`;

        let target: Element | null = null;
        try {
          target = selector ? document.querySelector(String(selector)) : null;
        } catch {}
        if (!target && ref) {
          const map = (window as any).__claudeElementMap;
          const value = map instanceof Map ? map.get(ref) : map?.[ref];
          target =
            value instanceof Element
              ? value
              : value?.element instanceof Element
                ? value.element
                : null;
        }
        const rect = target?.getBoundingClientRect();
        const x = rect?.left ?? Number((coordinates as any)?.x);
        const y = rect?.top ?? Number((coordinates as any)?.y);
        const width = rect?.width ?? ((coordinates as any) ? 28 : 0);
        const height = rect?.height ?? ((coordinates as any) ? 28 : 0);
        let highlight = document.getElementById(highlightId);
        if (Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0) {
          if (!highlight) {
            highlight = document.createElement('div');
            highlight.id = highlightId;
            Object.assign(highlight.style, {
              position: 'fixed',
              zIndex: '2147483646',
              pointerEvents: 'none',
              border: '3px solid #f97316',
              borderRadius: '5px',
              background: 'rgba(249,115,22,.12)',
              boxShadow: '0 0 0 2px rgba(255,255,255,.9)',
            });
            root.append(highlight);
          }
          Object.assign(highlight.style, {
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
            display: 'block',
          });
        }
        const key = '__mcpOperationOverlayTimer__';
        clearTimeout((window as any)[key]);
        if (state !== '执行中')
          (window as any)[key] = setTimeout(() => {
            status?.remove();
            highlight?.remove();
          }, 1800);
      },
    })
    .catch(() => undefined);
}

async function checkExpectedUrl(param: ToolCallParam): Promise<string | null> {
  const expectedUrl = String(param.args?.expectedUrl || '');
  if (!expectedUrl || !WRITE_TOOL.test(param.name)) return null;
  const tabId = param.args?.tabId;
  const tab =
    typeof tabId === 'number'
      ? await chrome.tabs.get(tabId)
      : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.url?.startsWith(expectedUrl))
    return `Expected URL prefix ${expectedUrl}, got ${tab?.url || 'none'}`;
  return null;
}

/**
 * Handle tool execution
 */
export const handleCallTool = async (param: ToolCallParam, signal?: AbortSignal) => {
  const tool = toolsMap.get(param.name);
  if (!tool) {
    return createErrorResponse(`Tool ${param.name} not found`);
  }

  try {
    if (signal?.aborted) return createErrorResponse('Tool call cancelled');
    const urlError = await checkExpectedUrl(param);
    if (urlError) return createErrorResponse(urlError);
    await showOperation(param, '执行中');
    const result = await tool.execute(param.args, signal);
    void showOperation(param, result.isError ? '失败' : '完成');
    return result;
  } catch (error) {
    void showOperation(param, '失败');
    console.error(`Tool execution failed for ${param.name}:`, error);
    return createErrorResponse(
      error instanceof Error ? error.message : ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
    );
  }
};
