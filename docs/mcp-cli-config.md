# CLI MCP Configuration Guide

This guide explains how to configure Codex CLI and Claude Code to connect to the Chrome MCP Server.

## Overview

The Chrome MCP Server exposes its compatibility MCP interface at `http://127.0.0.1:12306/mcp` (default port).
The early-access MCP 2026-07-28 endpoint is `http://127.0.0.1:12306/mcp-new`; legacy SSE and STDIO remain available.

## Codex CLI Configuration

### Option 1: HTTP MCP Server (Recommended)

Add the following to your `~/.codex/config.json`:

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

### Option 2: Via Environment Variable

Set the MCP URL via environment variable before running codex:

```bash
export MCP_HTTP_PORT=12306
```

### Early-access Streamable HTTP

Use this endpoint only with clients that support MCP 2026-07-28:

```json
{
  "mcpServers": {
    "chrome-mcp-new": {
      "url": "http://127.0.0.1:12306/mcp-new"
    }
  }
}
```

### Legacy SSE

- SSE endpoint: `http://127.0.0.1:12306/sse`
- Message endpoint: `http://127.0.0.1:12306/messages?sessionId=...`

## Claude Code Configuration

### Option 1: HTTP MCP Server

Add the following to your `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

### Option 2: Native Stdio Server (No extra bridge)

If you prefer stdio-based MCP communication:

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "command": "mcp-chrome-stdio",
      "env": {
        "MCP_SERVER_URL": "http://127.0.0.1:12306/mcp"
      }
    }
  }
}
```

The native stdio entry point uses the MCP SDK Streamable HTTP client, so it manages POST, SSE, and `sessionId` lifecycle on behalf of the stdio client. No separate `mcp-bridge.js` is required. Add `CHROME_MCP_API_KEY` to `env` when the HTTP server is protected.

## Verifying Connection

After configuration, the CLI tools should be able to see and use Chrome MCP tools such as:

- `chrome_get_windows_and_tabs` - Get browser window and tab information
- `chrome_navigate` - Navigate to a URL
- `chrome_click_element` - Click on page elements
- `chrome_get_page_content` - Get page content
- And more...

## Troubleshooting

### Connection Refused

If you get "connection refused" errors:

1. Ensure the Chrome extension is installed and the native server is running
2. Check that the port matches (default: 12306)
3. Verify no firewall is blocking localhost connections
4. Run `mcp-chrome-bridge doctor` to diagnose issues

### Tools Not Appearing

If MCP tools don't appear in the CLI:

1. Restart the CLI tool after configuration changes
2. Check the configuration file syntax (valid JSON)
3. Ensure the MCP server URL is accessible

### Port Conflicts

If port 12306 is already in use:

1. Set a custom port in the extension settings
2. Update the CLI configuration to match the new port
3. Run `mcp-chrome-bridge update-port <new-port>` to update the stdio config

## Environment Variables

| Variable                          | Description                                              | Default                        |
| --------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `MCP_HTTP_PORT`                   | HTTP port for MCP server                                 | 12306                          |
| `MCP_SERVER_URL`                  | Streamable HTTP endpoint used by the native stdio client | `http://127.0.0.1:12306/mcp`   |
| `MCP_SERVER_ORIGIN`               | Origin sent by the native stdio client                   | `chrome-extension://mcp-stdio` |
| `CHROME_MCP_API_KEY`              | Bearer key forwarded to the HTTP MCP server              | (none)                         |
| `CHROME_MCP_MAX_CONCURRENT_TOOLS` | Maximum browser tools executing at once                  | 8                              |
| `CHROME_MCP_MAX_QUEUED_TOOLS`     | Maximum browser tools waiting for a slot                 | 64                             |
| `MCP_ALLOWED_WORKSPACE_BASE`      | Additional allowed workspace directory                   | (none)                         |
| `CHROME_MCP_NODE_PATH`            | Override Node.js executable path                         | (auto)                         |
