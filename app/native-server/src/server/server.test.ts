import { describe, expect, test, afterAll, beforeAll, jest } from '@jest/globals';
import supertest from 'supertest';
import Server, { type ActiveMcpRequest, type McpRequestRecord } from './index';
import { ERROR_MESSAGES, isAllowedCorsOrigin, MCP_API_KEY_ENV } from '../constant';
import nativeMessagingHostInstance from '../native-messaging-host';

interface JsonRpcResponse {
  jsonrpc?: string;
  result: { tools?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

// Server keeps these fields private; the tests drive them directly.
interface ServerInternals {
  statelessMcpRequests: Map<string, ActiveMcpRequest>;
  mcpRequests: Map<string, ActiveMcpRequest>;
  recentMcpRequests: McpRequestRecord[];
  finishMcpRequest: (
    activeRequest: ActiveMcpRequest,
    status: 'success' | 'error' | 'cancelled',
    error?: string | null,
  ) => void;
}

const serverInternals = Server as unknown as ServerInternals;

function parseMcpResponse(response: { body?: unknown; text?: string }): JsonRpcResponse {
  const body = response.body;
  if (body && typeof body === 'object' && 'jsonrpc' in body) {
    // supertest parsed the JSON body; the MCP shape is checked by the assertions.
    return body as JsonRpcResponse;
  }
  const dataLine = response.text?.split(/\r?\n/).find((line) => line.startsWith('data:'));
  if (!dataLine) throw new Error('MCP response did not contain a JSON body');
  // The JSON-RPC payload travels in the SSE data line.
  return JSON.parse(dataLine.slice('data:'.length).trim()) as JsonRpcResponse;
}

describe('Server tests', () => {
  // Start the server test instance
  beforeAll(async () => {
    await Server.getInstance().ready();
  });

  // Close the server
  afterAll(async () => {
    await Server.stop();
  });

  test('GET /ping should return the correct response', async () => {
    const response = await supertest(Server.getInstance().server)
      .get('/ping')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      status: 'ok',
      message: 'pong',
    });
  });

  test('GET /status should return a diagnosable status', async () => {
    const response = await supertest(Server.getInstance().server)
      .get('/status')
      .set('Origin', 'http://127.0.0.1:1420')
      .expect(200);

    expect(response.body.server.version).toEqual(expect.any(String));
    expect(response.body.server.protocolVersion).toBe(2);
    expect(response.body.packages).toEqual({
      'mcp-chrome-bridge-2026': response.body.server.version,
    });
    expect(response.body.mcp).toMatchObject({
      activeSessions: 0,
      streamableHttp: true,
      recentRequests: expect.any(Array),
    });
    expect(response.body.tools.count).toBeGreaterThan(0);
    expect(response.body.toolAdmission).toMatchObject({
      active: 0,
      queued: 0,
      maxActive: expect.any(Number),
      maxQueued: expect.any(Number),
    });
    expect(response.body).toEqual(
      expect.objectContaining({
        connectionState: expect.any(String),
        pendingRequests: expect.any(Number),
        activeTools: expect.any(Number),
        queuedTools: expect.any(Number),
        reconnectCount: expect.any(Number),
        timeoutCount: expect.any(Number),
        cancelCount: expect.any(Number),
        queueRejectCount: expect.any(Number),
      }),
    );
  });

  test('Legacy Streamable HTTP should preserve the session lifecycle', async () => {
    Server.serviceEnabled = true;
    let sessionId: string | undefined;
    try {
      const response = await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Origin', 'http://127.0.0.1:1420')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'legacy-test-client', version: '1.0.0' },
          },
        })
        .expect(200);

      sessionId = response.headers['mcp-session-id'];
      expect(sessionId).toEqual(expect.any(String));
      const status = await supertest(Server.getInstance().server)
        .get('/status')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(200);
      expect(status.body.mcp.clients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionId, transport: 'streamable-http', endpoint: '/mcp' }),
        ]),
      );
    } finally {
      if (sessionId) {
        await supertest(Server.getInstance().server)
          .delete('/mcp')
          .set('Origin', 'http://127.0.0.1:1420')
          .set('Mcp-Session-Id', sessionId);
      }
      Server.serviceEnabled = false;
    }
  });

  test('MCP initialize → tools/list → tools/call forwards a browser result', async () => {
    Server.serviceEnabled = true;
    const connected = jest
      .spyOn(nativeMessagingHostInstance, 'isExtensionConnected')
      .mockReturnValue(true);
    const sendToExtension = jest
      .spyOn(nativeMessagingHostInstance, 'sendRequestToExtensionAndWait')
      .mockResolvedValue({
        status: 'success',
        data: {
          content: [
            { type: 'text', text: JSON.stringify({ tabId: 17, url: 'https://example.com' }) },
          ],
          isError: false,
        },
      });
    let sessionId: string | undefined;

    try {
      const initialized = await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Origin', 'http://127.0.0.1:1420')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'integration-test-client', version: '1.0.0' },
          },
        })
        .expect(200);
      sessionId = initialized.headers['mcp-session-id'];
      expect(sessionId).toEqual(expect.any(String));

      await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Origin', 'http://127.0.0.1:1420')
        .set('Accept', 'application/json, text/event-stream')
        .set('Mcp-Session-Id', sessionId!)
        .send({ jsonrpc: '2.0', method: 'notifications/initialized' })
        .expect(202);

      const listed = await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Origin', 'http://127.0.0.1:1420')
        .set('Accept', 'application/json, text/event-stream')
        .set('Mcp-Session-Id', sessionId!)
        .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
        .expect(200);
      expect(parseMcpResponse(listed).result.tools).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'chrome_get_tab_url' })]),
      );

      const called = await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Origin', 'http://127.0.0.1:1420')
        .set('Accept', 'application/json, text/event-stream')
        .set('Mcp-Session-Id', sessionId!)
        .send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'chrome_get_tab_url', arguments: { tabId: 17 } },
        })
        .expect(200);

      expect(parseMcpResponse(called).result).toMatchObject({
        content: [
          { type: 'text', text: JSON.stringify({ tabId: 17, url: 'https://example.com' }) },
        ],
        isError: false,
      });
      expect(sendToExtension).toHaveBeenLastCalledWith(
        { name: 'chrome_get_tab_url', args: { tabId: 17 } },
        'call_tool',
        expect.any(Number),
        expect.any(AbortSignal),
        undefined,
        expect.any(String),
      );
    } finally {
      if (sessionId) {
        await supertest(Server.getInstance().server)
          .delete('/mcp')
          .set('Origin', 'http://127.0.0.1:1420')
          .set('Mcp-Session-Id', sessionId);
      }
      connected.mockRestore();
      sendToExtension.mockRestore();
      Server.serviceEnabled = false;
    }
  });

  test('STDIO proxies should be marked as STDIO connections', async () => {
    Server.serviceEnabled = true;
    let sessionId: string | undefined;
    try {
      const response = await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Origin', 'chrome-extension://mcp-stdio')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'stdio-test-client', version: '1.0.0' },
          },
        })
        .expect(200);

      sessionId = response.headers['mcp-session-id'];
      const status = await supertest(Server.getInstance().server)
        .get('/status')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(200);
      expect(status.body.mcp.clients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionId, transport: 'stdio', endpoint: '/mcp' }),
        ]),
      );
    } finally {
      if (sessionId) {
        await supertest(Server.getInstance().server)
          .delete('/mcp')
          .set('Origin', 'chrome-extension://mcp-stdio')
          .set('Mcp-Session-Id', sessionId);
      }
      Server.serviceEnabled = false;
    }
  });

  test('Stateless Streamable HTTP (preview) requests should return the tool list', async () => {
    Server.serviceEnabled = true;
    try {
      const response = await supertest(Server.getInstance().server)
        .post('/mcp-new')
        .set('Origin', 'http://127.0.0.1:1420')
        .set('MCP-Protocol-Version', '2026-07-28')
        .set('Mcp-Method', 'tools/list')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {
            _meta: {
              'io.modelcontextprotocol/protocolVersion': '2026-07-28',
              'io.modelcontextprotocol/clientCapabilities': {},
              'io.modelcontextprotocol/clientInfo': {
                name: 'desktop-test-client',
                version: '1.2.3',
              },
            },
          },
        })
        .expect(200);

      expect(response.headers['mcp-session-id']).toBeUndefined();
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result.tools.length).toBeGreaterThan(0);

      const status = await supertest(Server.getInstance().server)
        .get('/status')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(200);
      expect(status.body.mcp.activeSessions).toBe(0);
      expect(status.body.mcp.stateless).toMatchObject({
        endpoint: '/mcp-new',
        transport: 'streamable-http',
        requestCount: expect.any(Number),
        lastRequestAt: expect.any(String),
        lastRequestLatencyMs: expect.any(Number),
        clientInfo: { name: 'desktop-test-client', version: '1.2.3' },
      });
      expect(status.body.mcp.recentRequests).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ method: 'tools/list' })]),
      );
    } finally {
      Server.serviceEnabled = false;
    }
  });

  test('Stateless active requests should be cancellable by ID', async () => {
    const server = serverInternals;
    let cancelCalls = 0;
    server.statelessMcpRequests.set('request-under-test', {
      requestId: 'request-under-test',
      method: 'tools/call',
      toolName: 'chrome_wait',
      jsonRpcId: 42,
      clientInfo: null,
      remoteAddress: '127.0.0.1',
      userAgent: 'test',
      startedAt: new Date().toISOString(),
      cancelRequestedAt: null,
      cancel: () => {
        cancelCalls++;
        return true;
      },
    });
    try {
      const status = await supertest(Server.getInstance().server)
        .get('/status')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(200);
      expect(status.body.mcp.stateless.requests).toEqual([
        expect.objectContaining({
          requestId: 'request-under-test',
          method: 'tools/call',
          toolName: 'chrome_wait',
          jsonRpcId: 42,
        }),
      ]);
      expect(status.body.mcp.requests).toEqual([
        expect.objectContaining({ requestId: 'request-under-test', status: 'running' }),
      ]);

      await supertest(Server.getInstance().server)
        .post('/__chrome_mcp_bridge/mcp-new/requests/request-under-test/cancel')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(202)
        .expect({ status: 'cancel_requested', requestId: 'request-under-test' });
      expect(cancelCalls).toBe(1);
    } finally {
      server.statelessMcpRequests.delete('request-under-test');
    }
  });

  test('Completed MCP requests should enter recent history capped at 20', () => {
    const server = serverInternals;
    const previousHistory = [...server.recentMcpRequests];
    const previousActive = new Map(server.mcpRequests);
    const makeRequest = (requestId: string, method = 'tools/call'): ActiveMcpRequest => ({
      requestId,
      method,
      toolName: method === 'tools/call' ? 'chrome_wait' : null,
      jsonRpcId: 1,
      endpoint: requestId.startsWith('new-') ? '/mcp-new' : '/mcp',
      transport: requestId.startsWith('stdio-') ? 'stdio' : 'streamable-http',
      sessionId: null,
      clientInfo: null,
      remoteAddress: '127.0.0.1',
      userAgent: 'test',
      startedAt: new Date().toISOString(),
      cancelRequestedAt: null,
      cancel: () => true,
    });

    try {
      server.recentMcpRequests.length = 0;
      server.mcpRequests.clear();

      const housekeeping = makeRequest('housekeeping', 'tools/list');
      server.mcpRequests.set(housekeeping.requestId, housekeeping);
      server.finishMcpRequest(housekeeping, 'success');
      expect(server.recentMcpRequests).toHaveLength(0);

      const failedProtocolRequest = makeRequest('failed-protocol', 'tools/list');
      server.mcpRequests.set(failedProtocolRequest.requestId, failedProtocolRequest);
      server.finishMcpRequest(failedProtocolRequest, 'error', 'invalid request');

      const cancelledRequest = makeRequest('stdio-cancelled');
      server.mcpRequests.set(cancelledRequest.requestId, cancelledRequest);
      server.finishMcpRequest(cancelledRequest, 'cancelled');

      expect(server.recentMcpRequests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requestId: 'failed-protocol',
            endpoint: '/mcp',
            transport: 'streamable-http',
            status: 'error',
            error: 'invalid request',
          }),
          expect.objectContaining({ requestId: 'stdio-cancelled', status: 'cancelled' }),
        ]),
      );

      for (let index = 0; index < 22; index++) {
        const request = makeRequest(`new-${index}`);
        server.mcpRequests.set(request.requestId, request);
        server.finishMcpRequest(request, 'success');
      }

      expect(server.recentMcpRequests).toHaveLength(20);
      expect(server.recentMcpRequests[0]).toMatchObject({
        requestId: 'new-21',
        endpoint: '/mcp-new',
        status: 'success',
      });
      expect(server.recentMcpRequests.at(-1)).toMatchObject({
        requestId: 'new-2',
        endpoint: '/mcp-new',
        status: 'success',
      });
      expect(server.recentMcpRequests).toEqual(
        expect.not.arrayContaining([expect.objectContaining({ requestId: 'housekeeping' })]),
      );
    } finally {
      server.recentMcpRequests.length = 0;
      server.recentMcpRequests.push(...previousHistory);
      server.mcpRequests.clear();
      for (const [requestId, request] of previousActive) server.mcpRequests.set(requestId, request);
    }
  });

  test('Legacy invalid protocol requests should be recorded as failed', async () => {
    Server.serviceEnabled = true;
    try {
      const response = await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Origin', 'http://127.0.0.1:1420')
        .send({ jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'chrome_wait' } })
        .expect(400);

      expect(response.body.error).toBe(ERROR_MESSAGES.INVALID_MCP_REQUEST);
      const status = await supertest(Server.getInstance().server)
        .get('/status')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(200);
      expect(status.body.mcp.recentRequests[0]).toMatchObject({
        method: 'tools/call',
        endpoint: '/mcp',
        transport: 'streamable-http',
        status: 'error',
        error: ERROR_MESSAGES.INVALID_MCP_REQUEST,
      });
    } finally {
      Server.serviceEnabled = false;
    }
  });

  test('Agent settings allow cross-origin PUT saves', async () => {
    const response = await supertest(Server.getInstance().server)
      .options('/agent/settings/deepseek')
      .set('Origin', 'chrome-extension://test')
      .set('Access-Control-Request-Method', 'PUT')
      .expect(204);

    expect(response.headers['access-control-allow-methods']).toContain('PUT');
  });

  test('CORS rejects a forged local Origin', () => {
    expect(isAllowedCorsOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedCorsOrigin('chrome-extension://test-extension')).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1.evil.example')).toBe(false);
    expect(isAllowedCorsOrigin('https://127.0.0.1')).toBe(false);
  });

  test('MCP rejects requests without Origin and without an API Key', async () => {
    const previousKey = process.env[MCP_API_KEY_ENV];
    delete process.env[MCP_API_KEY_ENV];
    try {
      const response = await supertest(Server.getInstance().server).post('/mcp').send({});
      expect(response.status).toBe(403);
      expect(response.body.error).toBe(ERROR_MESSAGES.ORIGIN_NOT_ALLOWED);
    } finally {
      if (previousKey === undefined) delete process.env[MCP_API_KEY_ENV];
      else process.env[MCP_API_KEY_ENV] = previousKey;
    }
  });

  test('MCP API Key allows protected requests without Origin and rejects a wrong Key', async () => {
    const previousKey = process.env[MCP_API_KEY_ENV];
    process.env[MCP_API_KEY_ENV] = 'server-test-key';
    try {
      await supertest(Server.getInstance().server)
        .options('/mcp')
        .set('Origin', 'chrome-extension://test')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      await supertest(Server.getInstance().server)
        .post('/mcp')
        .send({})
        .expect(401)
        .expect((response) => {
          expect(response.body.error).toBe('Missing or invalid MCP API key.');
        });

      const response = await supertest(Server.getInstance().server)
        .post('/mcp')
        .set('Authorization', 'Bearer server-test-key')
        .send({});
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    } finally {
      if (previousKey === undefined) delete process.env[MCP_API_KEY_ENV];
      else process.env[MCP_API_KEY_ENV] = previousKey;
    }
  });

  test('Agent private endpoints uniformly enforce Origin and API Key auth', async () => {
    const previousKey = process.env[MCP_API_KEY_ENV];
    delete process.env[MCP_API_KEY_ENV];
    try {
      await supertest(Server.getInstance().server)
        .get('/agent/engines')
        .expect(403)
        .expect((response) => {
          expect(response.body.error).toBe(ERROR_MESSAGES.ORIGIN_NOT_ALLOWED);
        });

      await supertest(Server.getInstance().server)
        .get('/agent/engines')
        .set('Origin', 'https://evil.example')
        .expect(403)
        .expect((response) => {
          expect(response.body.error).toBe(ERROR_MESSAGES.ORIGIN_NOT_ALLOWED);
        });

      await supertest(Server.getInstance().server)
        .get('/agent/engines')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(200);

      process.env[MCP_API_KEY_ENV] = 'agent-test-key';
      await supertest(Server.getInstance().server).get('/agent/engines').expect(401);
      await supertest(Server.getInstance().server)
        .get('/agent/engines')
        .set('x-api-key', 'agent-test-key')
        .expect(200);
      await supertest(Server.getInstance().server)
        .get('/agent/engines')
        .set('Authorization', 'Bearer agent-test-key')
        .expect(200);
    } finally {
      if (previousKey === undefined) delete process.env[MCP_API_KEY_ENV];
      else process.env[MCP_API_KEY_ENV] = previousKey;
    }
  });

  test('Runtime control endpoints are protected and return a redacted task list', async () => {
    const previousKey = process.env[MCP_API_KEY_ENV];
    delete process.env[MCP_API_KEY_ENV];
    try {
      await supertest(Server.getInstance().server).get('/__chrome_mcp_bridge/runtime').expect(403);
      const response = await supertest(Server.getInstance().server)
        .get('/__chrome_mcp_bridge/runtime')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(200);
      expect(response.body).toEqual(
        expect.objectContaining({ tasks: expect.any(Array), activeCount: expect.any(Number) }),
      );
      await supertest(Server.getInstance().server)
        .post('/__chrome_mcp_bridge/runtime/missing-task/cancel')
        .set('Origin', 'http://127.0.0.1:1420')
        .expect(404);
    } finally {
      if (previousKey === undefined) delete process.env[MCP_API_KEY_ENV];
      else process.env[MCP_API_KEY_ENV] = previousKey;
    }
  });
});
