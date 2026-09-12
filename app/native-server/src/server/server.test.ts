import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import supertest from 'supertest';
import Server from './index';
import { ERROR_MESSAGES, isAllowedCorsOrigin, MCP_API_KEY_ENV } from '../constant';

describe('服务器测试', () => {
  // 启动服务器测试实例
  beforeAll(async () => {
    await Server.getInstance().ready();
  });

  // 关闭服务器
  afterAll(async () => {
    await Server.stop();
  });

  test('GET /ping 应返回正确响应', async () => {
    const response = await supertest(Server.getInstance().server)
      .get('/ping')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      status: 'ok',
      message: 'pong',
    });
  });

  test('GET /status 应返回可诊断状态', async () => {
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

  test('兼容版 Streamable HTTP 应保留会话生命周期', async () => {
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

  test('STDIO 代理应标记为 STDIO 连接', async () => {
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

  test('Streamable HTTP（尝鲜版）无会话请求应返回工具列表', async () => {
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

  test('无会话活动请求应支持按 ID 中断', async () => {
    const server = Server as any;
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

  test('MCP 请求完成后应进入最近历史并保留 20 条', () => {
    const server = Server as any;
    const previousHistory = [...server.recentMcpRequests];
    const previousActive = new Map(server.mcpRequests);
    const makeRequest = (requestId: string, method = 'tools/call') => ({
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

  test('兼容版无效协议请求应记录为失败请求', async () => {
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

  test('智能助手设置允许跨域 PUT 保存', async () => {
    const response = await supertest(Server.getInstance().server)
      .options('/agent/settings/deepseek')
      .set('Origin', 'chrome-extension://test')
      .set('Access-Control-Request-Method', 'PUT')
      .expect(204);

    expect(response.headers['access-control-allow-methods']).toContain('PUT');
  });

  test('CORS 不接受伪造的本地 Origin', () => {
    expect(isAllowedCorsOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedCorsOrigin('chrome-extension://test-extension')).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1.evil.example')).toBe(false);
    expect(isAllowedCorsOrigin('https://127.0.0.1')).toBe(false);
  });

  test('MCP 拒绝没有 Origin 且没有 API Key 的请求', async () => {
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

  test('MCP API Key 允许无 Origin 的受保护请求并拒绝错误 Key', async () => {
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

  test('Agent 私有接口统一遵守 Origin 和 API Key 认证', async () => {
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

  test('运行时控制接口受保护并返回脱敏任务列表', async () => {
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
