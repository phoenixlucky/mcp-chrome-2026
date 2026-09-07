import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { ClaudeEngine } from './claude';
import * as projectService from '../project-service';

jest.mock('../project-service', () => ({
  getProject: jest.fn(),
}));

const getProject = jest.mocked(projectService.getProject);

function options(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    instruction: 'hello',
    projectRoot: process.cwd(),
    requestId: 'request-1',
    ...overrides,
  } as never;
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('ClaudeEngine SDK lifecycle', () => {
  test('streams SDK events, resumes a session, and persists callbacks', async () => {
    getProject.mockResolvedValue({ enableChromeMcp: false } as never);
    const query = jest.fn(async function* () {
      yield {
        type: 'system',
        subtype: 'init',
        session_id: 'claude-session-2',
        tools: ['Read'],
      };
      yield { type: 'stream_event', event: { type: 'message_start' } };
      yield {
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } },
      };
      yield { type: 'stream_event', event: { type: 'message_stop' } };
      yield {
        type: 'result',
        usage: { input_tokens: 2, output_tokens: 3 },
        total_cost_usd: 0.01,
      };
    });
    const emit = jest.fn();
    const persistClaudeSessionId = jest.fn(async (_id: string) => undefined);
    const persistManagementInfo = jest.fn(async (_info: unknown) => undefined);
    const engine = new ClaudeEngine({ loadQuery: async () => query });

    await engine.initializeAndRun(
      options({
        projectId: 'project-1',
        dbSessionId: 'db-session-1',
        resumeClaudeSessionId: 'old-session',
        permissionMode: 'default',
      }),
      { emit, persistClaudeSessionId, persistManagementInfo },
    );

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'hello' }),
    );
    expect(query.mock.calls[0]?.[0].options).toEqual(
      expect.objectContaining({ resume: 'old-session', permissionMode: 'default' }),
    );
    expect(persistClaudeSessionId).toHaveBeenCalledWith('claude-session-2');
    expect(persistManagementInfo).toHaveBeenCalledWith(
      expect.objectContaining({ tools: ['Read'] }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({ content: 'hello', isFinal: true }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'usage', data: expect.objectContaining({ outputTokens: 3 }) }),
    );
  });

  test('cleans up temporary image attachments after an SDK failure', async () => {
    const query = jest.fn(async function* () {
      yield { type: 'result', is_error: true, errors: ['SDK failed'] };
    });
    const engine = new ClaudeEngine({ loadQuery: async () => query });

    await expect(
      engine.initializeAndRun(
        options({
          attachments: [
            {
              type: 'image',
              name: 'fixture.png',
              mimeType: 'image/png',
              dataBase64: 'aGVsbG8=',
            },
          ],
        }),
        { emit: jest.fn() },
      ),
    ).rejects.toThrow('ClaudeEngine: SDK failed');

    const prompt = query.mock.calls[0]?.[0].prompt as string;
    const match = prompt.match(/Image #1 path: (.+)/);
    expect(match?.[1]).toBeTruthy();
    await expect(import('node:fs/promises').then((fs) => fs.access(match![1]))).rejects.toThrow();
  });

  test('surfaces SDK loader failures through the engine boundary', async () => {
    const engine = new ClaudeEngine({
      loadQuery: async () => {
        throw new Error('module unavailable');
      },
    });

    await expect(engine.initializeAndRun(options(), { emit: jest.fn() })).rejects.toThrow(
      'Failed to load Claude Agent SDK',
    );
  });
});
