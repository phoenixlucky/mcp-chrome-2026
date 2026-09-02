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
    const response = await supertest(Server.getInstance().server).get('/status').expect(200);

    expect(response.body.server.version).toEqual(expect.any(String));
    expect(response.body.packages).toEqual({
      'mcp-chrome-bridge-2026': response.body.server.version,
    });
    expect(response.body.mcp).toMatchObject({ activeSessions: 0, streamableHttp: true });
    expect(response.body.tools.count).toBeGreaterThan(0);
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
      const status = await supertest(Server.getInstance().server).get('/status').expect(200);
      expect(status.body.mcp.clients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionId, transport: 'streamable-http' }),
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

      const status = await supertest(Server.getInstance().server).get('/status').expect(200);
      expect(status.body.mcp.activeSessions).toBe(0);
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
});
