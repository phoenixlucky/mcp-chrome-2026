#!/usr/bin/env node

const mcpUrl = new URL(process.env.CHROME_MCP_SMOKE_URL || 'http://127.0.0.1:12306/mcp');
const origin = process.env.CHROME_MCP_SMOKE_ORIGIN || 'chrome-extension://chrome-mcp-smoke';
const apiKey = process.env.CHROME_MCP_API_KEY?.trim();
const timeoutMs = Number(process.env.CHROME_MCP_SMOKE_TIMEOUT_MS || 15_000);

function headers(extra = {}) {
  return {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    Origin: origin,
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...extra,
  };
}

async function request(path, init = {}) {
  const response = await fetch(new URL(path, mcpUrl), {
    ...init,
    headers: headers(init.headers),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${path} failed with HTTP ${response.status}: ${text}`);
  }
  return { response, text };
}

function parseProtocolResponse(text) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    const dataLine = trimmed
      .split(/\r?\n/)
      .find((line) => line.startsWith('data:'));
    if (dataLine) return JSON.parse(dataLine.slice('data:'.length).trim());
  }
  throw new Error(`MCP returned an unreadable response: ${trimmed.slice(0, 300)}`);
}

async function postMcp(message, sessionId) {
  const { response, text } = await request('/mcp', {
    method: 'POST',
    headers: sessionId ? { 'mcp-session-id': sessionId } : {},
    body: JSON.stringify(message),
  });
  return { value: parseProtocolResponse(text), sessionId: response.headers.get('mcp-session-id') || sessionId };
}

async function main() {
  const statusUrl = new URL('/status?probe=1', mcpUrl);
  const { text: statusText } = await request(statusUrl.pathname + statusUrl.search);
  const status = JSON.parse(statusText);
  if (status.extension?.connected !== true && status.nativeHost?.connected !== true) {
    throw new Error('Chrome extension is not connected to the Native Host. Load the extension and retry.');
  }
  if (status.probe?.ok !== true) {
    throw new Error(`Native Host → Chrome probe failed: ${status.probe?.error || 'unknown error'}`);
  }

  const initialized = await postMcp({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'chrome-mcp-smoke', version: '1.0.0' },
    },
  });
  if (initialized.value?.error) throw new Error(`MCP initialize failed: ${JSON.stringify(initialized.value.error)}`);

  const sessionId = initialized.sessionId;
  if (!sessionId) throw new Error('MCP initialize did not return mcp-session-id.');

  await postMcp(
    { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
    sessionId,
  );

  const listed = await postMcp(
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    sessionId,
  );
  const tools = listed.value?.result?.tools;
  if (!Array.isArray(tools) || !tools.some((tool) => tool.name === 'chrome_get_tab_url')) {
    throw new Error('MCP tools/list did not expose chrome_get_tab_url.');
  }

  const called = await postMcp(
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'chrome_get_tab_url', arguments: {} },
    },
    sessionId,
  );
  if (called.value?.error || called.value?.result?.isError) {
    throw new Error(`MCP → Chrome tool call failed: ${JSON.stringify(called.value)}`);
  }

  console.log(
    `Chrome MCP smoke passed: Native Host connected, ${tools.length} tools discovered, chrome_get_tab_url executed.`,
  );
}

main().catch((error) => {
  console.error(`Chrome MCP smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
