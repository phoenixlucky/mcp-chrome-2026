import { type ToolResult } from '@/common/tool-handler';
import { getProxyDiagnostics } from '@/entrypoints/background/proxy';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';

class ProxyDiagnosticsTool {
  name = TOOL_NAMES.BROWSER.PROXY_DIAGNOSTICS;

  async execute(args: { action?: 'status' | 'test' }): Promise<ToolResult> {
    if (args.action && args.action !== 'status' && args.action !== 'test') {
      return { content: [{ type: 'text', text: 'action must be status or test.' }], isError: true };
    }
    return {
      content: [
        { type: 'text', text: JSON.stringify(await getProxyDiagnostics(args.action === 'test')) },
      ],
      isError: false,
    };
  }
}

export const proxyDiagnosticsTool = new ProxyDiagnosticsTool();
