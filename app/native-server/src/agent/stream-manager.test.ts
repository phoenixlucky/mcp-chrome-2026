import { afterEach, describe, expect, jest, test } from '@jest/globals';
import type { ServerResponse } from 'node:http';
import { AgentStreamManager } from './stream-manager';
import type { RealtimeEvent } from './types';

function sseClient() {
  return {
    writableEnded: false,
    destroyed: false,
    write: jest.fn(),
    end: jest.fn(),
  } as unknown as ServerResponse & { write: jest.Mock; end: jest.Mock };
}

function message(sessionId: string, content = 'hello'): RealtimeEvent {
  return {
    type: 'message',
    data: {
      id: `message-${sessionId}`,
      sessionId,
      role: 'assistant',
      content,
      messageType: 'chat',
      cliSource: 'deepseek',
      isStreaming: false,
      isFinal: true,
      createdAt: new Date().toISOString(),
    },
  };
}

afterEach(() => jest.useRealTimers());

describe('AgentStreamManager', () => {
  test('routes session events only to clients subscribed to that session', () => {
    const manager = new AgentStreamManager();
    const first = sseClient();
    const second = sseClient();
    manager.addSseStream('session-1', first);
    manager.addSseStream('session-2', second);

    manager.publish(message('session-1'));

    expect(first.write).toHaveBeenCalledTimes(1);
    expect(first.write.mock.calls[0][0]).toContain('session-1');
    expect(second.write).not.toHaveBeenCalled();
    manager.closeAll();
  });

  test('removes clients that throw while receiving an event', () => {
    const manager = new AgentStreamManager();
    const client = sseClient();
    client.write.mockImplementation(() => {
      throw new Error('closed');
    });
    manager.addSseStream('session-1', client);

    manager.publish(message('session-1'));
    manager.publish(message('session-1', 'second'));

    expect(client.write).toHaveBeenCalledTimes(1);
    manager.closeAll();
    expect(client.end).not.toHaveBeenCalled();
  });

  test('broadcasts heartbeats and stops the timer after the last client is removed', () => {
    jest.useFakeTimers();
    const manager = new AgentStreamManager();
    const client = sseClient();
    manager.addSseStream('session-1', client);

    jest.advanceTimersByTime(30_000);
    expect(client.write).toHaveBeenCalledTimes(1);
    expect(client.write.mock.calls[0][0]).toContain('heartbeat');

    manager.removeSseStream('session-1', client);
    jest.advanceTimersByTime(60_000);
    expect(client.write).toHaveBeenCalledTimes(1);
  });

  test('routes websocket events and closes all clients during shutdown', () => {
    const manager = new AgentStreamManager();
    const socket = { readyState: 1, send: jest.fn(), close: jest.fn() };
    manager.addWebSocket('session-1', socket);

    manager.publish(message('session-1'));
    manager.closeAll();

    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(socket.send.mock.calls[0][0]).toContain('session-1');
    expect(socket.close).toHaveBeenCalledTimes(1);
  });
});
