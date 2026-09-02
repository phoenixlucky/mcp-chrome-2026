import {
  type CallToolResult,
  type ServerContext,
  type Tool,
  Server,
} from '@modelcontextprotocol/server';
import { TOOL_SCHEMAS } from '@ethanwilkins/chrome-mcp-shared-2026';
import { filterToolsByPermission, getToolPermissionPolicy } from './permission-policy.js';
import { handleToolCall, listDynamicFlowTools } from './register-tools.js';

type ToolProgressReporter = (progress: Record<string, unknown>) => void | Promise<void>;

/** Register the same Chrome tools for the 2026-07-28 per-request server. */
export const setupModernTools = (server: Server): void => {
  server.setRequestHandler('tools/list', async () => {
    const dynamicTools = await listDynamicFlowTools();
    const policy = getToolPermissionPolicy();
    return {
      tools: filterToolsByPermission([...TOOL_SCHEMAS, ...dynamicTools] as Tool[], policy),
    };
  });

  server.setRequestHandler('tools/call', async (request, ctx: ServerContext) => {
    const progressToken = ctx.mcpReq._meta?.progressToken;
    let lastProgress = -1;
    const reportProgress: ToolProgressReporter | undefined =
      progressToken === undefined
        ? undefined
        : (progress) => {
            const candidate =
              typeof progress.completed === 'number' && Number.isFinite(progress.completed)
                ? Math.max(0, Math.floor(progress.completed))
                : 0;
            const nextProgress = Math.max(lastProgress + 1, candidate);
            lastProgress = nextProgress;
            const total =
              typeof progress.total === 'number' &&
              Number.isFinite(progress.total) &&
              progress.total >= nextProgress
                ? progress.total
                : undefined;
            return ctx.mcpReq.notify({
              method: 'notifications/progress',
              params: {
                progressToken,
                progress: nextProgress,
                ...(total === undefined ? {} : { total }),
                message: JSON.stringify(progress),
              },
            });
          };

    return (await handleToolCall(
      request.params.name,
      request.params.arguments || {},
      ctx.mcpReq.signal,
      reportProgress,
    )) as unknown as CallToolResult;
  });
};
