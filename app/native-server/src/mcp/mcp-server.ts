import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools.js';
import packageJson from '../../package.json';

/** Existing stateful Streamable HTTP and legacy SSE server. */
export const getMcpServer = () => {
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

  setupTools(mcpServer);
  return mcpServer;
};
