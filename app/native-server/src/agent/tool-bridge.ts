import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { NATIVE_SERVER_PORT } from '../constant/index.js';
import { UnifiedMcpClient } from '../mcp/unified-transport.js';

export interface CliToolInvocation {
  /**
   * The MCP server identifier (if provided by CLI).
   * When omitted, this bridge defaults to the local chrome MCP server.
   */
  server?: string;
  /**
   * The MCP tool name to invoke.
   */
  tool: string;
  /**
   * JSON-serializable arguments for the tool call.
   */
  args?: Record<string, unknown>;
  signal?: AbortSignal;
  deadlineAt?: number;
}

export interface AgentToolBridgeOptions {
  /**
   * Base URL of the local MCP HTTP endpoint (e.g. http://127.0.0.1:12306/mcp-new).
   * If omitted, DEFAULT_SERVER_PORT from chrome-mcp-shared is used.
   */
  mcpUrl?: string;
}

/**
 * AgentToolBridge maps CLI tool events (Codex, etc.) to MCP tool calls
 * against the local chrome MCP server via the official MCP SDK client.
 *
 * 中文说明：该桥接层负责将 CLI 上报的工具调用统一转为标准 MCP CallTool 请求，
 * 复用统一的 /mcp-new HTTP client，并自动回退到 /mcp 兼容端点。
 */
export class AgentToolBridge {
  private readonly client: UnifiedMcpClient;

  constructor(options: AgentToolBridgeOptions = {}) {
    const url =
      options.mcpUrl ||
      `http://127.0.0.1:${process.env.MCP_HTTP_PORT || NATIVE_SERVER_PORT}/mcp-new`;
    this.client = new UnifiedMcpClient({
      url,
      clientName: 'chrome-mcp-agent-bridge',
      clientVersion: '2',
    });
  }

  /**
   * Connects the MCP client over Streamable HTTP if not already connected.
   */
  async ensureConnected(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Invoke an MCP tool based on a CLI tool event.
   * Returns the raw result from MCP client.callTool().
   */
  async callTool(invocation: CliToolInvocation): Promise<CallToolResult> {
    await this.ensureConnected();

    const args = invocation.args ?? {};
    const result = await this.client.callTool(invocation.tool, args, {
      signal: invocation.signal,
      deadlineAt: invocation.deadlineAt,
    });

    // The SDK returns a compatible structure; cast to satisfy strict typing.
    return result as unknown as CallToolResult;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
