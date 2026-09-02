# `/mcp-new` 接口说明

`/mcp-new` 是 MCP `2026-07-28` 的 Streamable HTTP 尝鲜入口。它采用按请求处理的无会话模式：客户端不需要先执行 `initialize` / `notifications/initialized`，也不需要保存或回传 `Mcp-Session-Id`。

## 地址与请求要求

默认地址：

```text
http://127.0.0.1:12306/mcp-new
```

每一条 JSON-RPC 请求都必须单独发送为 HTTP `POST`，并同时满足以下要求：

- `Content-Type: application/json`
- `Accept` 同时声明 `application/json` 和 `text/event-stream`
- 请求头 `MCP-Protocol-Version: 2026-07-28`
- 请求头 `Mcp-Method` 与 JSON-RPC 的 `method` 完全一致
- 请求头 `Mcp-Name` 与本次请求的名称字段一致；调用工具时，它必须与 `params.name` 一致。对于 `tools/list` 这类没有名称字段的请求，使用 `tools/list`
- JSON-RPC 请求体的 `params` 中必须包含 `_meta`
- `_meta.io.modelcontextprotocol/protocolVersion` 必须为 `2026-07-28`，并与 `MCP-Protocol-Version` 一致

HTTP 请求头名称不区分大小写，但请求头的值区分大小写。`Mcp-Name` 应使用可安全放入 HTTP header 的值；如果名称包含非 ASCII 字符，应按 MCP 规范使用 Base64 sentinel 编码。

`_meta` 不是 HTTP 请求头，而是 JSON-RPC 请求体中的元数据。建议同时携带客户端能力和客户端信息：

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

## 请求示例

### 获取工具列表

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

### 调用工具

`Mcp-Name` 必须与 `params.name` 相同。例如调用 `chrome_get_windows_and_tabs`：

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

## 响应与错误

- 普通请求返回 `application/json` 的 JSON-RPC 响应。
- 需要发送进度通知时，响应可以是 `text/event-stream`，最后仍会返回该请求的 JSON-RPC 结果。
- `/mcp-new` 不会返回 `Mcp-Session-Id`，请求之间也不共享 MCP 会话。
- 缺少必需请求头、请求头与请求体不一致，或协议版本不一致时，应按 `400 Bad Request` 处理。
- 如果服务启用了 API Key，仍需按服务端配置发送 `Authorization: Bearer <key>`；Origin 校验也继续生效。

## 与 `/mcp` 的区别

| 项目             | `/mcp-new`                       | `/mcp`                     |
| ---------------- | -------------------------------- | -------------------------- |
| 协议版本         | MCP `2026-07-28`                 | 兼容现有客户端的会话版     |
| 初始化握手       | 不需要                           | 需要                       |
| `Mcp-Session-Id` | 不使用                           | 使用                       |
| 请求模型         | 每条请求独立 POST                | 按会话复用连接             |
| 适用场景         | 支持新协议和按请求元数据的客户端 | 暂不支持新协议的现有客户端 |

## 客户端配置

仅在客户端支持 MCP `2026-07-28`、并能为每条请求生成上述请求头和 `_meta` 时使用：

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

不支持这些请求要求的客户端请继续使用 `/mcp`。协议背景可参考 [MCP Streamable HTTP 规范](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx)。
