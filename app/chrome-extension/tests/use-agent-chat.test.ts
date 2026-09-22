import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentChat } from '@/entrypoints/sidepanel/composables/useAgentChat';

function createChat() {
  let serverReady = true;
  const openEventSource = vi.fn();
  const chat = useAgentChat({
    getServerPort: () => 4321,
    getSessionId: () => 'session-1',
    ensureServer: async () => serverReady,
    openEventSource,
  });
  return { chat, openEventSource, setServerReady: (value: boolean) => (serverReady = value) };
}

function okResponse(requestId: string): Response {
  return new Response(JSON.stringify({ requestId, sessionId: 'session-1', status: 'accepted' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useAgentChat retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries with a new request id and links it to the failed request', async () => {
    const { chat, openEventSource } = createChat();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okResponse('request-1'))
      .mockResolvedValueOnce(okResponse('request-2'));

    chat.input.value = 'Fix the issue';
    await chat.send({ projectId: 'project-1', dbSessionId: 'session-1' });
    expect(openEventSource).toHaveBeenCalledOnce();

    chat.handleRealtimeEvent({
      type: 'error',
      error: 'The provider timed out',
      data: {
        sessionId: 'session-1',
        requestId: 'request-1',
        errorInfo: {
          category: 'timeout',
          phase: 'model',
          userMessage: 'The request took too long to complete',
          retryable: true,
          requestId: 'request-1',
        },
      },
    });

    expect(chat.canRetry.value).toBe(true);
    await chat.retryLastRequest();

    const retryPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(retryPayload.retryOfRequestId).toBe('request-1');
    expect(retryPayload.instruction).toBe('Fix the issue');
    expect(chat.input.value).toBe('');
  });

  it('restores the prompt after a retry attempt fails again', async () => {
    const { chat } = createChat();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okResponse('request-1'))
      .mockResolvedValueOnce(okResponse('request-2'));

    chat.input.value = 'Retry me';
    await chat.send({ projectId: 'project-1' });
    chat.handleRealtimeEvent({
      type: 'error',
      error: 'temporary timeout',
      data: {
        sessionId: 'session-1',
        requestId: 'request-1',
        errorInfo: {
          category: 'timeout',
          phase: 'model',
          userMessage: 'The request took too long to complete',
          retryable: true,
        },
      },
    });
    await chat.retryLastRequest();

    chat.handleRealtimeEvent({
      type: 'error',
      error: 'temporary timeout',
      data: {
        sessionId: 'session-1',
        requestId: 'request-2',
        errorInfo: {
          category: 'timeout',
          phase: 'model',
          userMessage: 'The request took too long to complete',
          retryable: true,
        },
      },
    });

    expect(chat.input.value).toBe('Retry me');
    expect(chat.canRetry.value).toBe(true);
  });

  it('does not turn cancellation into an error banner', async () => {
    const { chat } = createChat();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okResponse('request-1'));

    chat.input.value = 'Stop me';
    await chat.send({ projectId: 'project-1' });
    chat.handleRealtimeEvent({
      type: 'status',
      data: {
        sessionId: 'session-1',
        requestId: 'request-1',
        status: 'cancelled',
        phase: 'cancel',
        message: 'Execution cancelled by user',
      },
    });

    expect(chat.errorMessage.value).toBeNull();
    expect(chat.requestState.value).toBe('cancelled');
  });
});
