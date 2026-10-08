# Smart Assistant Guide

## Get started

1. Start the Native Server and reload the Chrome extension.
2. Open **Smart Assistant** in the extension side panel, then create or select a project and session.
3. Choose Claude, Codex, or DeepSeek in the project menu; select a model in session settings.

The assistant uses a warm, professional catgirl persona while keeping task and tool execution reliable.

## Configure DeepSeek

Open the side-panel settings menu and select **DeepSeek API Settings**. Enter an API key and, if needed, a Base URL. The saved setting is available to every DeepSeek session.

- The key is sent only to the local Native Server; read APIs return configuration status, never the plaintext key.
- The key is stored in the local assistant database. Use **Remove saved key** after using a shared computer.
- You can instead set `DEEPSEEK_API_KEY` before starting the server, with optional `DEEPSEEK_BASE_URL`. A saved plugin setting takes precedence.
- Refer to the [official DeepSeek documentation](https://api-docs.deepseek.com/) for API and model details.

PowerShell example:

```powershell
$env:DEEPSEEK_API_KEY = 'your-api-key'
pnpm run dev:native
```

## Current limits

DeepSeek currently provides basic streamed text chat and displays reasoning content when supplied by the API. It does not yet support MCP tool calls, conversation resumption, image input, or file input. Choose Claude or Codex when those capabilities are required.

## Troubleshooting

- **API key is not configured**: save it in extension settings or set the environment variable and restart the Native Server.
- **Credit balance is too low**: the provider account has insufficient balance or quota; review the DeepSeek account and retry.
- **Request failed**: verify the Base URL, network, and selected model. The assistant displays the HTTP status and a concise provider message.
