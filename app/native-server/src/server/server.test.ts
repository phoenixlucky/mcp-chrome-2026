import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import supertest from 'supertest';
import Server from './index';
import { isAllowedCorsOrigin } from '../constant';

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
});
