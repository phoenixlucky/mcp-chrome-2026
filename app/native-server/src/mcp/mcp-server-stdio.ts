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
import { spawn, type ChildProcess } from 'node:child_process';
import packageJson from '../../package.json';
import { checkToolAccess, filterToolsByPermission } from './permission-policy.js';
import { UnifiedMcpClient, type UnifiedRequestOptions } from './unified-transport.js';
import { UnifiedStdioServerTransport } from './stdio-transport.js';

let stdioMcpServer: Server | null = null;
let mcpClient: UnifiedMcpClient | null = null;
let mcpClientConnectPromise: Promise<UnifiedMcpClient | undefined> | null = null;

const DEFAULT_MCP_SERVER_ORIGIN = 'chrome-extension://mcp-stdio';
const DEFAULT_AUTOSTART_TIMEOUT_MS = 8_000;
const DEFAULT_AUTOSTART_POLL_MS = 150;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

let embeddedHttpServer: ChildProcess | null = null;
let cleanupRegistered = false;

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

function isTruthyEnvironmentValue(value: string | undefined): boolean {
  return value === undefined || !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function getLocalServerConfig(rawUrl: string): { pingUrl: string; port: number } | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) return null;

    const port = Number(url.port || '80');
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

    return { pingUrl: `${url.origin}/ping`, port };
  } catch {
    return null;
  }
}

async function isHttpServerReady(pingUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 750);
  try {
    const response = await fetch(pingUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHttpServer(pingUrl: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHttpServerReady(pingUrl)) return true;
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_AUTOSTART_POLL_MS));
  }
  return isHttpServerReady(pingUrl);
}

function stopEmbeddedHttpServer(): void {
  if (!embeddedHttpServer || embeddedHttpServer.killed) return;
  embeddedHttpServer.kill();
  embeddedHttpServer = null;
}

async function ensureLocalHttpServer(url: string): Promise<void> {
  if (!isTruthyEnvironmentValue(process.env.CHROME_MCP_AUTOSTART_SERVER)) return;

  const localConfig = getLocalServerConfig(url);
  if (!localConfig) return;
  if (await isHttpServerReady(localConfig.pingUrl)) return;

  if (!embeddedHttpServer) {
    const serverEntry = path.join(__dirname, '..', 'index.js');
    embeddedHttpServer = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env,
        CHROME_MCP_STANDALONE: '1',
        CHROME_MCP_PORT: String(localConfig.port),
        MCP_HTTP_PORT: String(localConfig.port),
      },
      stdio: 'ignore',
      detached: false,
      windowsHide: true,
    });
    embeddedHttpServer.once('error', () => {
      embeddedHttpServer = null;
    });
    if (!cleanupRegistered) {
      cleanupRegistered = true;
      process.once('exit', stopEmbeddedHttpServer);
    }
  }

  if (!(await waitForHttpServer(localConfig.pingUrl, DEFAULT_AUTOSTART_TIMEOUT_MS))) {
    stopEmbeddedHttpServer();
    throw new Error(
      `无法启动本地 MCP HTTP 服务。请检查端口 ${localConfig.port}，或设置 CHROME_MCP_AUTOSTART_SERVER=0 后手动启动服务。`,
    );
  }
}

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
      if (!config || typeof config.url !== 'string' || !config.url.trim()) {
        throw new Error('MCP_SERVER_URL 或 stdio-config.json 中的 url 无效');
      }
      await ensureLocalHttpServer(config.url);
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

export async function runStdioServer(): Promise<void> {
  const transport = new UnifiedStdioServerTransport();
  await getStdioMcpServer().connect(transport);
}

if (require.main === module) {
  runStdioServer().catch((error) => {
    console.error('Fatal error Chrome MCP Server main():', error);
    process.exit(1);
  });
}
