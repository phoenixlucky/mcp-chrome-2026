// start-server.js - Starts the native host and sends START to launch HTTP server
const { spawn } = require('child_process');
const path = require('path');

const child = spawn('node', [path.join(__dirname, 'dist', 'index.js')], {
  stdio: ['pipe', 'inherit', 'inherit'],
});

// Send START message via native messaging protocol
const msg = JSON.stringify({ type: 'start', payload: { port: 12306 } });
const buf = Buffer.alloc(4);
buf.writeUInt32LE(Buffer.byteLength(msg), 0);
child.stdin.write(Buffer.concat([buf, Buffer.from(msg)]));

// Keep stdin open - don't call end() as the native host needs it for Chrome
// The HTTP server is now running on port 12306

child.on('exit', (code) => process.exit(code));
