import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { AgentChatService } from './chat-service';
import { AgentStreamManager } from './stream-manager';
import type { AgentEngine } from './engines/types';
import * as projectService from './project-service';
import * as messageService from './message-service';
import * as sessionService from './session-service';

jest.mock('./project-service', () => ({
  getProject: jest.fn(),
  touchProjectActivity: jest.fn(),
  updateProjectClaudeSessionId: jest.fn(),
}));
jest.mock('./message-service', () => ({ createMessage: jest.fn() }));
jest.mock('./session-service', () => ({
  getSession: jest.fn(),
  updateEngineSessionId: jest.fn(),
  updateManagementInfo: jest.fn(),
  touchSessionActivity: jest.fn(),
}));
jest.mock('./attachment-service', () => ({
  attachmentService: { saveAttachment: jest.fn() },
}));

const project = {
  id: 'project-1',
  name: 'Test project',
  rootPath: process.cwd(),
  preferredCli: 'deepseek',
  selectedModel: 'project-model',
  useCcr: false,
};

const getProject = jest.mocked(projectService.getProject);
const touchProjectActivity = jest.mocked(projectService.touchProjectActivity);
const persistAgentMessage = jest.mocked(messageService.createMessage);
const getSession = jest.mocked(sessionService.getSession);

function createEngine(
  run: AgentEngine['initializeAndRun'],
  name: AgentEngine['name'] = 'deepseek',
): AgentEngine {
  return { name, supportsMcp: false, initializeAndRun: run };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('AgentChatService lifecycle', () => {
  test('rejects requests without a project before starting an engine', async () => {
    const engine = createEngine(jest.fn());
    const service = new AgentChatService({
      engines: [engine],
      streamManager: new AgentStreamManager(),
    });

    await expect(service.handleAct('session-1', { instruction: 'hello' })).rejects.toThrow(
      'projectId is required',
    );
    expect(engine.initializeAndRun).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });

  test('passes project configuration to the engine and cleans up after success', async () => {
    getProject.mockResolvedValue(project);
    touchProjectActivity.mockResolvedValue(undefined);
    persistAgentMessage.mockResolvedValue(undefined);
    const engineRun = jest.fn(async (options, context) => {
      context.emit({
        type: 'message',
        data: {
          id: 'assistant-1',
          sessionId: options.sessionId,
          role: 'assistant',
          content: 'done',
          messageType: 'chat',
          cliSource: 'deepseek',
          requestId: options.requestId,
          isStreaming: false,
          isFinal: true,
          createdAt: new Date().toISOString(),
        },
      });
    });
    const streamManager = new AgentStreamManager();
    const publish = jest.spyOn(streamManager, 'publish');
    const service = new AgentChatService({
      engines: [createEngine(engineRun)],
      streamManager,
    });

    const result = await service.handleAct('session-1', {
      instruction: '  hello  ',
      projectId: 'project-1',
      model: 'request-model',
      requestId: 'request-1',
      clientMeta: { source: 'test' },
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(result).toEqual({ requestId: 'request-1' });
    expect(engineRun).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: 'hello',
        model: 'request-model',
        projectRoot: project.rootPath,
        projectId: 'project-1',
        requestId: 'request-1',
        signal: expect.any(AbortSignal),
      }),
      expect.any(Object),
    );
    expect(persistAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: 'hello', requestId: 'request-1' }),
    );
    expect(publish.mock.calls.map(([event]) => event.type)).toEqual(
      expect.arrayContaining(['message', 'status']),
    );
    expect(publish.mock.calls.map(([event]) => event.data?.status)).toEqual(
      expect.arrayContaining(['starting', 'running', 'completed']),
    );
    expect(service.getRunningExecutions()).toEqual([]);
  });

  test('emits an error and removes a failed execution from the registry', async () => {
    getProject.mockResolvedValue(project);
    touchProjectActivity.mockResolvedValue(undefined);
    persistAgentMessage.mockResolvedValue(undefined);
    const streamManager = new AgentStreamManager();
    const publish = jest.spyOn(streamManager, 'publish');
    const service = new AgentChatService({
      engines: [createEngine(jest.fn().mockRejectedValue(new Error('engine failed')))],
      streamManager,
    });

    await service.handleAct('session-1', {
      instruction: 'hello',
      projectId: 'project-1',
      requestId: 'request-2',
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', error: 'engine failed' }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'status',
        data: expect.objectContaining({ status: 'error', requestId: 'request-2' }),
      }),
    );
    expect(service.getRunningExecutions()).toEqual([]);
  });

  test('cancels an active execution once and reports no-op on repeat cancellation', async () => {
    getProject.mockResolvedValue(project);
    touchProjectActivity.mockResolvedValue(undefined);
    persistAgentMessage.mockResolvedValue(undefined);
    let resolveEngine!: () => void;
    const engineRun = jest.fn(
      (options: Parameters<AgentEngine['initializeAndRun']>[0]) =>
        new Promise<void>((resolve) => {
          resolveEngine = resolve;
          options.signal?.addEventListener('abort', resolve, { once: true });
        }),
    );
    const streamManager = new AgentStreamManager();
    const publish = jest.spyOn(streamManager, 'publish');
    const service = new AgentChatService({
      engines: [createEngine(engineRun)],
      streamManager,
    });

    await service.handleAct('session-1', {
      instruction: 'hello',
      projectId: 'project-1',
      requestId: 'request-3',
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(service.cancelExecution('request-3')).toBe(true);
    expect(service.cancelExecution('request-3')).toBe(false);
    resolveEngine?.();
    await new Promise((resolve) => setImmediate(resolve));
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'status',
        data: expect.objectContaining({ status: 'cancelled', requestId: 'request-3' }),
      }),
    );
    expect(service.getRunningExecutions()).toEqual([]);
  });
});
