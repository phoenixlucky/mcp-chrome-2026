import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DeepSeekEngine } from './deepseek';
import type { RealtimeEvent } from '../types';
import { closeDb } from '../db/client';
import { updateDeepSeekSettings } from '../settings-service';

const originalApiKey = process.env.DEEPSEEK_API_KEY;
const originalDbFile = process.env.CHROME_MCP_AGENT_DB_FILE;
let testDbDir = '';

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

function run(engine = new DeepSeekEngine()): { events: RealtimeEvent[]; promise: Promise<void> } {
  const events: RealtimeEvent[] = [];
  return {
    events,
    promise: engine.initializeAndRun(
      {
        sessionId: 'session',
        requestId: 'request',
        instruction: 'hello',
        model: 'deepseek-v4-flash',
      },
      { emit: (event) => events.push(event) },
    ),
  };
}

beforeEach(() => {
  testDbDir = mkdtempSync(path.join(tmpdir(), 'chrome-mcp-deepseek-'));
  process.env.CHROME_MCP_AGENT_DB_FILE = path.join(testDbDir, 'agent.db');
});

afterEach(() => {
  jest.restoreAllMocks();
  closeDb();
  rmSync(testDbDir, { recursive: true, force: true });
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalApiKey;
  if (originalDbFile === undefined) delete process.env.CHROME_MCP_AGENT_DB_FILE;
  else process.env.CHROME_MCP_AGENT_DB_FILE = originalDbFile;
});

describe('DeepSeekEngine', () => {
  test('explains how to configure a missing API key', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(run().promise).rejects.toThrow('configure a DeepSeek API key');
  });

  test('streams split reasoning and answer chunks, then finalizes the message', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        streamResponse([
          'data: {"choices":[{"delta":{"reasoning_content":"思"}}]}\n\n',
          'data: {"choices":[{"delta":{"reasoning_content":"考","content":"答"}}]}\n',
          'data: {"choices":[{"delta":{"content":"案"}}]}\n\ndata: [DONE]\n\n',
        ]),
      );

    const { events, promise } = run();
    await promise;

    const messages = events.filter((event) => event.type === 'message').map((event) => event.data);
    expect(messages.at(-1)).toMatchObject({
      content: '💭 思考\n\n答案',
      isStreaming: false,
      isFinal: true,
    });
  });

  test('uses the API key saved from the extension before the environment variable', async () => {
    process.env.DEEPSEEK_API_KEY = 'environment-key';
    await updateDeepSeekSettings({ apiKey: 'plugin-key' });
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(streamResponse(['data: [DONE]\n\n']));

    await run().promise;

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer plugin-key' }),
      }),
    );
  });

  test('uses the provider message for HTTP failures without echoing the response body', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":{"message":"insufficient balance"},"secret":"do-not-show"}', {
        status: 402,
        statusText: 'Payment Required',
      }),
    );

    await expect(run().promise).rejects.toThrow('DeepSeek API 402: insufficient balance');
  });

  test('reports malformed SSE data clearly', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(streamResponse(['data: not-json\n\n']));

    await expect(run().promise).rejects.toThrow('DeepSeek API returned malformed stream data');
  });
});
