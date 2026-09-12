import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerAgentRoutes } from './agent';
import { AgentStreamManager } from '../../agent/stream-manager';
import * as projectService from '../../agent/project-service';
import * as sessionService from '../../agent/session-service';
import * as messageService from '../../agent/message-service';
import * as attachmentServiceModule from '../../agent/attachment-service';

jest.mock('../../agent/project-service', () => ({
  createProjectDirectory: jest.fn(),
  deleteProject: jest.fn(),
  listProjects: jest.fn(),
  upsertProject: jest.fn(),
  validateRootPath: jest.fn(),
  getProject: jest.fn(),
}));
jest.mock('../../agent/session-service', () => ({
  createSession: jest.fn(),
  deleteSession: jest.fn(),
  getSession: jest.fn(),
  getSessionsByProject: jest.fn(),
  getSessionsByProjectAndEngine: jest.fn(),
  getAllSessions: jest.fn(),
  updateSession: jest.fn(),
}));
jest.mock('../../agent/message-service', () => ({
  createMessage: jest.fn(),
  deleteMessagesByProjectId: jest.fn(),
  deleteMessagesBySessionId: jest.fn(),
  getMessagesByProjectId: jest.fn(),
  getMessagesCountByProjectId: jest.fn(),
  getMessagesBySessionId: jest.fn(),
  getMessagesCountBySessionId: jest.fn(),
}));
jest.mock('../../agent/storage', () => ({
  getDefaultWorkspaceDir: jest.fn(),
  getDefaultProjectRoot: jest.fn(),
}));
jest.mock('../../agent/directory-picker', () => ({ openDirectoryPicker: jest.fn() }));
jest.mock('../../agent/open-project', () => ({
  openProjectDirectory: jest.fn(),
  openFileInVSCode: jest.fn(),
}));
jest.mock('../../agent/settings-service', () => ({
  getDeepSeekSettings: jest.fn(),
  updateDeepSeekSettings: jest.fn(),
}));
jest.mock('../../agent/attachment-service', () => ({
  attachmentService: {
    getAttachmentStats: jest.fn(),
    cleanupProjectAttachments: jest.fn(),
    cleanupOrphanedAttachments: jest.fn(),
    getAttachmentPath: jest.fn(),
  },
}));

const getProject = jest.mocked(projectService.getProject);
const upsertProject = jest.mocked(projectService.upsertProject);
const deleteProject = jest.mocked(projectService.deleteProject);
const createSession = jest.mocked(sessionService.createSession);
const getSession = jest.mocked(sessionService.getSession);
const updateSession = jest.mocked(sessionService.updateSession);
const deleteMessagesBySessionId = jest.mocked(messageService.deleteMessagesBySessionId);
const getAttachmentPath = jest.mocked(attachmentServiceModule.attachmentService.getAttachmentPath);

const project = {
  id: 'project-1',
  name: 'Project',
  rootPath: 'D:/workspace/project',
  preferredCli: 'claude',
  selectedModel: null,
  useCcr: false,
};
const session = {
  id: 'session-1',
  projectId: 'project-1',
  engineName: 'claude',
  engineSessionId: 'claude-old',
};

function createApp() {
  const app = Fastify();
  const chatService = {
    getEngineInfos: jest.fn(() => [{ name: 'claude', supportsMcp: true }]),
    handleAct: jest.fn(async () => ({ requestId: 'request-1' })),
    cancelExecution: jest.fn(() => true),
    cancelSessionExecutions: jest.fn(() => 1),
  };
  registerAgentRoutes(app, {
    streamManager: new AgentStreamManager(),
    chatService,
  } as never);
  return { app, chatService };
}

beforeEach(() => {
  jest.clearAllMocks();
  getProject.mockResolvedValue(project as never);
  getSession.mockResolvedValue(session as never);
  updateSession.mockResolvedValue(undefined as never);
  deleteMessagesBySessionId.mockResolvedValue(2 as never);
  upsertProject.mockResolvedValue(project as never);
  createSession.mockResolvedValue(session as never);
});

afterEach(() => jest.restoreAllMocks());

describe('agent route integration', () => {
  test('covers project CRUD and session creation validation', async () => {
    const { app } = createApp();
    await app.ready();

    const created = await app.inject({
      method: 'POST',
      url: '/agent/projects',
      payload: { name: 'Project', rootPath: 'D:/workspace/project' },
    });
    expect(created.statusCode).toBe(200);
    expect(upsertProject).toHaveBeenCalled();

    const updatedProject = await app.inject({
      method: 'POST',
      url: '/agent/projects',
      payload: { id: 'project-1', name: 'Renamed', rootPath: 'D:/workspace/project' },
    });
    expect(updatedProject.statusCode).toBe(200);
    expect(upsertProject).toHaveBeenCalledTimes(2);

    const deleted = await app.inject({ method: 'DELETE', url: '/agent/projects/project-1' });
    expect(deleted.statusCode).toBe(204);
    expect(deleteProject).toHaveBeenCalledWith('project-1');

    const invalid = await app.inject({
      method: 'POST',
      url: '/agent/projects/project-1/sessions',
      payload: { engineName: 'not-an-engine' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(createSession).not.toHaveBeenCalled();

    const createdSession = await app.inject({
      method: 'POST',
      url: '/agent/projects/project-1/sessions',
      payload: { engineName: 'claude', name: 'Conversation' },
    });
    expect(createdSession.statusCode).toBe(201);
    expect(createSession).toHaveBeenCalledWith(
      'project-1',
      'claude',
      expect.objectContaining({ name: 'Conversation' }),
    );

    const updatedSession = await app.inject({
      method: 'PATCH',
      url: '/agent/sessions/session-1',
      payload: { name: 'Renamed conversation' },
    });
    expect(updatedSession.statusCode).toBe(200);
    expect(updateSession).toHaveBeenCalledWith('session-1', { name: 'Renamed conversation' });

    const deletedSession = await app.inject({
      method: 'DELETE',
      url: '/agent/sessions/session-1',
    });
    expect(deletedSession.statusCode).toBe(204);

    await app.close();
  });

  test('returns not-found resources and resets a session in order', async () => {
    const { app } = createApp();
    await app.ready();

    getProject.mockResolvedValueOnce(undefined);
    const missingProject = await app.inject({
      method: 'POST',
      url: '/agent/projects/missing/sessions',
      payload: { engineName: 'claude' },
    });
    expect(missingProject.statusCode).toBe(404);

    const reset = await app.inject({ method: 'POST', url: '/agent/sessions/session-1/reset' });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual(
      expect.objectContaining({
        success: true,
        deletedMessages: expect.anything(),
        clearedEngineSessionId: true,
      }),
    );
    expect(updateSession).toHaveBeenCalledWith('session-1', { engineSessionId: null });

    getSession.mockResolvedValueOnce(undefined);
    const missingSession = await app.inject({
      method: 'POST',
      url: '/agent/sessions/missing/reset',
    });
    expect(missingSession.statusCode).toBe(404);

    await app.close();
  });

  test('accepts act requests and makes cancellation idempotent at the route boundary', async () => {
    const { app, chatService } = createApp();
    await app.ready();

    const act = await app.inject({
      method: 'POST',
      url: '/agent/chat/session-1/act',
      payload: { instruction: 'hello', projectId: 'project-1' },
    });
    expect(act.statusCode).toBe(200);
    expect(act.json()).toEqual({
      requestId: 'request-1',
      sessionId: 'session-1',
      status: 'accepted',
    });

    const cancelled = await app.inject({
      method: 'DELETE',
      url: '/agent/chat/session-1/cancel/request-1',
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toEqual(expect.objectContaining({ success: true }));

    chatService.cancelExecution.mockReturnValueOnce(false);
    const repeated = await app.inject({
      method: 'DELETE',
      url: '/agent/chat/session-1/cancel/request-1',
    });
    expect(repeated.json()).toEqual(expect.objectContaining({ success: false }));

    const all = await app.inject({ method: 'DELETE', url: '/agent/chat/session-1/cancel' });
    expect(all.statusCode).toBe(200);
    expect(all.json()).toEqual(expect.objectContaining({ cancelledCount: 1 }));
    await app.close();
  });

  test('exposes engine diagnostics and rejects malformed act requests', async () => {
    const { app, chatService } = createApp();
    await app.ready();

    const engines = await app.inject({ method: 'GET', url: '/agent/engines' });
    expect(engines.statusCode).toBe(200);
    expect(engines.json()).toEqual({ engines: [{ name: 'claude', supportsMcp: true }] });

    chatService.handleAct.mockRejectedValueOnce(new Error('projectId is required'));
    const badAct = await app.inject({
      method: 'POST',
      url: '/agent/chat/session-1/act',
      payload: { instruction: 'hello' },
    });
    expect(badAct.statusCode).toBe(400);
    expect(badAct.json()).toEqual({ error: 'projectId is required' });

    await app.close();
  });

  test('streams attachments with private no-store caching', async () => {
    const { app } = createApp();
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-mcp-route-'));
    const filePath = path.join(dataDir, 'attachment.png');
    await fs.writeFile(filePath, 'payload');
    getAttachmentPath.mockReturnValue(filePath);

    await app.ready();
    const response = await app.inject({
      method: 'GET',
      url: '/agent/attachments/project-1/attachment.png',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');

    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
});
