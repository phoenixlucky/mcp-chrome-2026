import { Server } from '@modelcontextprotocol/server';
import { setupModernTools } from './register-tools-modern.js';
import packageJson from '../../package.json';

/** Stateless server for the MCP 2026-07-28 Streamable HTTP endpoint. */
export const getModernMcpServer = () => {
  const mcpServer = new Server(
    {
      name: 'ChromeMcpServer',
      version: packageJson.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  setupModernTools(mcpServer);
  return mcpServer;
};
