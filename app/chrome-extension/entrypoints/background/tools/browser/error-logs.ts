import { type ToolResult } from '@/common/tool-handler';
import { clearPluginErrorLogs, readPluginErrorLogs } from '@/entrypoints/background/error-log';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';

class ErrorLogsTool {
  name = TOOL_NAMES.BROWSER.ERROR_LOGS;

  async execute(args: { action?: 'read' | 'clear' } = {}): Promise<ToolResult> {
    if (args.action === 'clear') await clearPluginErrorLogs();
    return {
      content: [{ type: 'text', text: JSON.stringify({ logs: await readPluginErrorLogs() }) }],
      isError: false,
    };
  }
}

export const errorLogsTool = new ErrorLogsTool();
