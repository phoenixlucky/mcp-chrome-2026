# `/mcp-new` Endpoint Reference

`/mcp-new` is a preview entry point for MCP `2026-07-28` Streamable HTTP. It uses a stateless, per-request model: clients do not need to run `initialize` / `notifications/initialized` first, and do not need to store or send back an `Mcp-Session-Id`.

## Address and Request Requirements

Default address:

```text
http://127.0.0.1:12306/mcp-new
```

Every JSON-RPC request must be sent separately as an HTTP `POST` and must satisfy all of the following requirements:

- `Content-Type: application/json`
- `Accept` declares both `application/json` and `text/event-stream`
- The `MCP-Protocol-Version: 2026-07-28` header
- The `Mcp-Method` header matches the JSON-RPC `method` exactly
- The `Mcp-Name` header matches this request's name field; when calling a tool, it must match `params.name`. For requests without a name field, such as `tools/list`, use `tools/list`
- The JSON-RPC request body's `params` must contain `_meta`
- `_meta.io.modelcontextprotocol/protocolVersion` must be `2026-07-28` and must match `MCP-Protocol-Version`

HTTP header names are case-insensitive, but header values are case-sensitive. `Mcp-Name` should use a value that is safe to place in an HTTP header; if the name contains non-ASCII characters, encode it with the Base64 sentinel as specified by MCP.

`_meta` is not an HTTP header; it is metadata in the JSON-RPC request body. It is recommended to also include the client capabilities and client info:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
    "io.modelcontextprotocol/clientInfo": {
      "name": "my-client",
      "version": "1.0.0"
    }
  }
}
```

## Request Examples

### List tools

```http
POST /mcp-new HTTP/1.1
Host: 127.0.0.1:12306
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/list
Mcp-Name: tools/list

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "my-client",
        "version": "1.0.0"
      }
    }
  }
}
```

### Call a tool

`Mcp-Name` must be identical to `params.name`. For example, to call `chrome_get_windows_and_tabs`:

```http
POST /mcp-new HTTP/1.1
Host: 127.0.0.1:12306
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: chrome_get_windows_and_tabs

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "chrome_get_windows_and_tabs",
    "arguments": {},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "my-client",
        "version": "1.0.0"
      }
    }
  }
}
```

## Responses and Errors

- Ordinary requests return a JSON-RPC response as `application/json`.
- When progress notifications must be sent, the response can be `text/event-stream`, and the JSON-RPC result for the request is still returned at the end.
- `/mcp-new` never returns an `Mcp-Session-Id`, and MCP sessions are not shared between requests.
- A missing required header, a header that disagrees with the request body, or a protocol version mismatch is handled as `400 Bad Request`.
- If the service has an API key enabled, still send `Authorization: Bearer <key>` as configured on the server; Origin validation also still applies.

## Differences from `/mcp`

| Item                 | `/mcp-new`                                                     | `/mcp`                                                |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| Protocol version     | MCP `2026-07-28`                                               | Session-based, compatible with existing clients       |
| Initialize handshake | Not needed                                                     | Needed                                                |
| `Mcp-Session-Id`     | Not used                                                       | Used                                                  |
| Request model        | Each request is an independent POST                            | Connection reused per session                         |
| Use case             | Clients that support the new protocol and per-request metadata | Existing clients that do not support the new protocol |

## Client Configuration

Use this only when the client supports MCP `2026-07-28` and can generate the headers and `_meta` above for every request:

```json
{
  "mcpServers": {
    "chrome-mcp-new": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp-new"
    }
  }
}
```

Clients that do not support these request requirements should keep using `/mcp`. For protocol background, see the [MCP Streamable HTTP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx).
