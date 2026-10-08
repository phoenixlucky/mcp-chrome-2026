# Fastify Chrome Native Messaging service

This is a Fastify-based TypeScript project used for native communication with a Chrome extension.

## Features

- Bidirectional communication with the Chrome extension through the Chrome Native Messaging protocol
- **Multi-browser support**: Chrome and Chromium (including Linux, macOS, and Windows)
- Provides a RESTful API service
- Developed entirely in TypeScript
- Includes a complete test suite
- Follows code quality best practices

## Development environment setup

### Prerequisites

- Node.js 20+
- npm 8+ or pnpm 8+

### Installation

```bash
git clone https://github.com/your-username/fastify-chrome-native.git
cd fastify-chrome-native
npm install
```

### Development

1. Build and register the native server locally

```bash
cd app/native-server
npm run dev
```

2. Start the chrome extension

```bash
cd app/chrome-extension
npm run dev
```

### Build

```bash
npm run build
```

### Registering the Native Messaging host

#### Automatically detect and register all installed browsers

```bash
mcp-chrome-bridge register --detect
```

#### Register a specific browser

```bash
# Register Chrome only
mcp-chrome-bridge register --browser chrome

# Register Chromium only
mcp-chrome-bridge register --browser chromium

# Register all supported browsers
mcp-chrome-bridge register --browser all
```

#### Global installation (automatically registers detected browsers)

```bash
npm i -g mcp-chrome-bridge
```

#### Browser support

| Browser       | Linux | macOS | Windows |
| ------------- | ----- | ----- | ------- |
| Google Chrome | ✓     | ✓     | ✓       |
| Chromium      | ✓     | ✓     | ✓       |

Registration locations:

- **Linux**: `~/.config/[browser-name]/NativeMessagingHosts/`
- **macOS**: `~/Library/Application Support/[Browser]/NativeMessagingHosts/`
- **Windows**: `%APPDATA%\[Browser]\NativeMessagingHosts\`

### Integrating with the Chrome extension

The following is a simple example of how to use this service from a Chrome extension:

```javascript
// background.js
let nativePort = null;
let serverRunning = false;

// Start the Native Messaging service
function startServer() {
  if (nativePort) {
    console.log('Already connected to the Native Messaging host');
    return;
  }

  try {
    nativePort = chrome.runtime.connectNative('com.yourcompany.fastify_native_host');

    nativePort.onMessage.addListener((message) => {
      console.log('Received native message:', message);

      if (message.type === 'started') {
        serverRunning = true;
        console.log(`Service started, port: ${message.payload.port}`);
      } else if (message.type === 'stopped') {
        serverRunning = false;
        console.log('Service stopped');
      } else if (message.type === 'error') {
        console.error('Native error:', message.payload.message);
      }
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('Native connection disconnected:', chrome.runtime.lastError);
      nativePort = null;
      serverRunning = false;
    });

    // Start the server
    nativePort.postMessage({ type: 'start', payload: { port: 3000 } });
  } catch (error) {
    console.error('Error starting Native Messaging:', error);
  }
}

// Stop the server
function stopServer() {
  if (nativePort && serverRunning) {
    nativePort.postMessage({ type: 'stop' });
  }
}

// Test communication with the server
async function testPing() {
  try {
    const response = await fetch('http://localhost:3000/ping');
    const data = await response.json();
    console.log('Ping response:', data);
    return data;
  } catch (error) {
    console.error('Ping failed:', error);
    return null;
  }
}

// Connect to the Native host when the extension starts
chrome.runtime.onStartup.addListener(startServer);

// Expose an API for the popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startServer') {
    startServer();
    sendResponse({ success: true });
  } else if (message.action === 'stopServer') {
    stopServer();
    sendResponse({ success: true });
  } else if (message.action === 'testPing') {
    testPing().then(sendResponse);
    return true; // Indicates that we will send the response asynchronously
  }
});
```

### Testing

```bash
npm run test
```

### License

MIT
