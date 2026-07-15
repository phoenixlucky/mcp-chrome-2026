/**
 * Start the MCP HTTP server directly, without waiting for the Chrome extension
 * to send a START message via native messaging.
 *
 * Usage: node start-server.js
 * Server will be available at http://127.0.0.1:12306/mcp
 */

const { Server } = require('./dist/server/index');

const port = parseInt(process.argv[2] || '12306', 10);
const server = new Server();

async function main() {
  try {
    await server.start(port);
    console.log(`✓ MCP HTTP server running on http://127.0.0.1:${port}/mcp`);
    console.log(`  Health check: http://127.0.0.1:${port}/ping`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `✗ Port ${port} is already in use. Kill the existing process or use a different port.`,
      );
    } else {
      console.error('✗ Failed to start server:', err.message);
    }
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  try {
    await server.fastify.close();
  } catch {}
  process.exit(0);
});

process.on('SIGTERM', async () => {
  try {
    await server.fastify.close();
  } catch {}
  process.exit(0);
});

main();
