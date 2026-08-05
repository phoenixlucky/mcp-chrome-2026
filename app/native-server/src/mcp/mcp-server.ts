import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools';
import packageJson from '../../package.json';

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
