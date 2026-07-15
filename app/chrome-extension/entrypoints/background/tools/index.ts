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
    return await tool.execute(param.args, signal);
  } catch (error) {
    console.error(`Tool execution failed for ${param.name}:`, error);
    return createErrorResponse(
      error instanceof Error ? error.message : ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
    );
  }
};
