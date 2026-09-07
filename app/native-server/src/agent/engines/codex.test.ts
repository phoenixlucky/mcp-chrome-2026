import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { CodexEngine } from './codex';

function createChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    killed: boolean;
    kill: jest.Mock;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = jest.fn(() => {
    child.killed = true;
    child.emit('close', null, null);
    return true;
  });
  return child;
}

function options(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    instruction: 'hello',
    projectRoot: process.cwd(),
    requestId: 'request-1',
    codexConfig: { appendProjectContext: false },
    ...overrides,
  } as never;
}

function context() {
  return { emit: jest.fn() } as never;
}

afterEach(() => {
  delete process.env.CODEX_ENGINE_TIMEOUT_MS;
});

describe('CodexEngine process lifecycle', () => {
  test('streams messages and ignores malformed JSON lines', async () => {
    const child = createChild();
    const spawnMock = jest.fn(() => child) as unknown as typeof spawn;
    const ctx = context() as { emit: jest.Mock };
    const engine = new CodexEngine(undefined, { spawn: spawnMock });

    const execution = engine.initializeAndRun(options(), ctx as never);
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.end(
      [
        'not-json',
        JSON.stringify({ type: 'item.delta', delta: { type: 'agent_message', text: 'hello' } }),
        JSON.stringify({ type: 'turn.completed' }),
      ].join('\n'),
    );

    await expect(execution).resolves.toBeUndefined();
    expect(ctx.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({ content: 'hello', isFinal: false }),
      }),
    );
    expect(child.kill).toHaveBeenCalled();
  });

  test('rejects when the process exits non-zero', async () => {
    const child = createChild();
    const spawnMock = jest.fn(() => child) as unknown as typeof spawn;
    const engine = new CodexEngine(undefined, { spawn: spawnMock });

    const execution = engine.initializeAndRun(options(), context());
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.end();
    child.emit('close', 7, null);

    await expect(execution).rejects.toThrow('process terminated (exit code 7)');
  });

  test('rejects and kills the process on AbortSignal cancellation', async () => {
    const child = createChild();
    const spawnMock = jest.fn(() => child) as unknown as typeof spawn;
    const controller = new AbortController();
    const engine = new CodexEngine(undefined, { spawn: spawnMock });

    const execution = engine.initializeAndRun(options({ signal: controller.signal }), context());
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(execution).rejects.toThrow('execution was cancelled');
    expect(child.kill).toHaveBeenCalled();
  });

  test('times out a stalled process', async () => {
    process.env.CODEX_ENGINE_TIMEOUT_MS = '10';
    const child = createChild();
    const spawnMock = jest.fn(() => child) as unknown as typeof spawn;
    const engine = new CodexEngine(undefined, { spawn: spawnMock });

    await expect(engine.initializeAndRun(options(), context())).rejects.toThrow(
      'execution timed out',
    );
    expect(child.kill).toHaveBeenCalled();
  });

  test('cleans up temporary image attachments after completion', async () => {
    const child = createChild();
    const spawnMock = jest.fn(() => child) as unknown as typeof spawn;
    const engine = new CodexEngine(undefined, { spawn: spawnMock });

    const execution = engine.initializeAndRun(
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
      context(),
    );
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.end(JSON.stringify({ type: 'turn.completed' }));
    await expect(execution).resolves.toBeUndefined();

    const args = spawnMock.mock.calls[0]?.[1] as string[];
    const imagePath = args[args.indexOf('--image') + 1];
    expect(imagePath).toBeTruthy();
    await expect(import('node:fs/promises').then((fs) => fs.access(imagePath))).rejects.toThrow();
  });
});
