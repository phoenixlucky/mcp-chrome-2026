// start-server.js - Starts the HTTP server directly (bypasses native messaging)
// This provides the HTTP endpoint for MCP clients.
// Chrome extension connects via native messaging separately.
const path = require('path');

// Import the server module directly
const server = require(path.join(__dirname, 'dist', 'server'));
const nativeHost = require(path.join(__dirname, 'dist', 'native-messaging-host'));

server.default.setNativeHost(nativeHost.default);
nativeHost.default.setServer(server.default);

// Start the HTTP server immediately on port 12306 (without waiting for START message)
server.default.start(12306, nativeHost.default).then(() => {
  console.log('HTTP server started on http://127.0.0.1:12306/mcp');
  console.log('Press Ctrl+C to stop');
}).catch((err) => {
  console.error('Failed to start HTTP server:', err.message);
  process.exit(1);
});
