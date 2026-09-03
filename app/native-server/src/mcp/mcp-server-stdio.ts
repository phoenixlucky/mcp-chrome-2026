#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { TOOL_SCHEMAS } from '@ethanwilkins/chrome-mcp-shared-2026';
import * as fs from 'fs';
import * as path from 'path';
import packageJson from '../../package.json';
import { checkToolAccess, filterToolsByPermission } from './permission-policy.js';
import { UnifiedMcpClient, type UnifiedRequestOptions } from './unified-transport.js';
import { UnifiedStdioServerTransport } from './stdio-transport.js';

let stdioMcpServer: Server | null = null;
let mcpClient: UnifiedMcpClient | null = null;
let mcpClientConnectPromise: Promise<UnifiedMcpClient | undefined> | null = null;

const DEFAULT_MCP_SERVER_ORIGIN = 'chrome-extension://mcp-stdio';

// Read configuration from stdio-config.json
const loadConfig = () => {
  const envUrl = process.env.MCP_SERVER_URL?.trim();
  if (envUrl) return { url: envUrl };

  try {
    const configPath = path.join(__dirname, 'stdio-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Failed to load stdio-config.json:', error);
    throw new Error('Configuration file stdio-config.json not found or invalid');
  }
};

export const getStdioMcpServer = () => {
  if (stdioMcpServer) {
    return stdioMcpServer;
  }
  stdioMcpServer = new Server(
    {
      name: 'StdioChromeMcpServer',
      version: packageJson.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  setupTools(stdioMcpServer);
  return stdioMcpServer;
};

export const ensureMcpClient = async (options: UnifiedRequestOptions = {}) => {
  if (mcpClient) return mcpClient;
  if (mcpClientConnectPromise) return mcpClientConnectPromise;

  const connection = (async (): Promise<UnifiedMcpClient | undefined> => {
    try {
      const config = loadConfig();
      const apiKey = process.env.CHROME_MCP_API_KEY?.trim();
      const requestHeaders: Record<string, string> = {
        // Keep the backwards-compatible no-key STDIO transport distinguishable
        // from an unauthenticated request with no Origin header.
        Origin: process.env.MCP_SERVER_ORIGIN?.trim() || DEFAULT_MCP_SERVER_ORIGIN,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      };
      mcpClient = new UnifiedMcpClient({
        url: config.url,
        headers: requestHeaders,
        clientName: 'Mcp Chrome Proxy',
        clientVersion: packageJson.version,
      });
      await mcpClient.connect(options);
      return mcpClient;
    } catch (error) {
      await mcpClient?.close();
      mcpClient = null;
      console.error('Failed to connect to MCP server:', error);
      return undefined;
    }
  })();
  mcpClientConnectPromise = connection;
  try {
    return await connection;
  } finally {
    if (mcpClientConnectPromise === connection) mcpClientConnectPromise = null;
  }
};

const resetMcpClient = () => {
  const client = mcpClient;
  mcpClient = null;
  void client?.close();
};

export const setupTools = (server: Server) => {
  // Mirror the upstream HTTP catalog so dynamic flow tools are discoverable over STDIO.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const client = await ensureMcpClient();
    if (!client) return { tools: filterToolsByPermission(TOOL_SCHEMAS) };
    try {
      const result = await client.listTools();
      return { ...result, tools: filterToolsByPermission(result.tools) };
    } catch {
      resetMcpClient();
      return { tools: filterToolsByPermission(TOOL_SCHEMAS) };
    }
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) =>
    handleToolCall(request.params.name, request.params.arguments || {}, extra),
  );
};

const handleToolCall = async (
  name: string,
  args: any,
  extra?: RequestHandlerExtra<any, any>,
): Promise<CallToolResult> => {
  try {
    const access = checkToolAccess(name);
    if (!access.allowed) {
      return {
        content: [{ type: 'text', text: access.message || 'Tool call not allowed.' }],
        isError: true,
      };
    }
    const client = await ensureMcpClient({ signal: extra?.signal });
    if (!client) {
      throw new Error('Failed to connect to MCP server');
    }
    // Use a sane default of 2 minutes; the previous value mistakenly used 2*6*1000 (12s)
    const DEFAULT_CALL_TIMEOUT_MS = 2 * 60 * 1000;
    const progressToken = extra?._meta?.progressToken;
    try {
      const result = await client.callTool(name, args, {
        timeoutMs: DEFAULT_CALL_TIMEOUT_MS,
        signal: extra?.signal,
        meta: extra?._meta,
        onProgress:
          progressToken === undefined
            ? undefined
            : (progress) => {
                void extra?.sendNotification({
                  method: 'notifications/progress',
                  params: {
                    progressToken,
                    progress: progress.progress,
                    ...(progress.total === undefined ? {} : { total: progress.total }),
                    ...(progress.message === undefined ? {} : { message: progress.message }),
                  },
                });
              },
      });
      return result as CallToolResult;
    } catch (error) {
      resetMcpClient();
      throw error;
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};

async function main() {
  const transport = new UnifiedStdioServerTransport();
  await getStdioMcpServer().connect(transport);
}

main().catch((error) => {
  console.error('Fatal error Chrome MCP Server main():', error);
  process.exit(1);
});
