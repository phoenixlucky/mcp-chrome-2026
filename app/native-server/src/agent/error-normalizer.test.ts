import { normalizeAgentError } from './error-normalizer';

describe('normalizeAgentError', () => {
  it('classifies connection failures as retryable', () => {
    const result = normalizeAgentError(new Error('fetch failed: ECONNREFUSED'), {
      requestId: 'req-1',
      sessionId: 'session-1',
      phase: 'connection',
    });

    expect(result).toMatchObject({
      category: 'connection',
      phase: 'connection',
      retryable: true,
      requestId: 'req-1',
      sessionId: 'session-1',
    });
  });

  it('classifies authentication failures as non-retryable engine errors', () => {
    const result = normalizeAgentError(new Error('401 Unauthorized: api_key=sk-secret'), {
      phase: 'model',
    });

    expect(result.category).toBe('engine');
    expect(result.retryable).toBe(false);
    expect(result.technicalMessage).not.toContain('sk-secret');
    expect(result.userMessage).toContain('authentication');
  });

  it('classifies timeouts as retryable', () => {
    const result = normalizeAgentError(new Error('CodexEngine: execution timed out'), {
      phase: 'model',
    });

    expect(result).toMatchObject({
      category: 'timeout',
      retryable: true,
      phase: 'model',
    });
  });

  it('normalizes cancellation as a neutral non-retryable result', () => {
    const result = normalizeAgentError(new Error('Execution cancelled by user'), {
      phase: 'cancel',
    });

    expect(result).toMatchObject({
      category: 'cancelled',
      phase: 'cancel',
      retryable: false,
      userMessage: 'Request cancelled',
    });
  });

  it('supports explicit tool context and redacts bearer credentials', () => {
    const result = normalizeAgentError(new Error('Tool failed: Bearer abc123'), {
      phase: 'tool',
      toolName: 'computer',
    });

    expect(result).toMatchObject({
      category: 'tool',
      phase: 'tool',
      toolName: 'computer',
      retryable: false,
    });
    expect(result.technicalMessage).toContain('[REDACTED]');
    expect(result.technicalMessage).not.toContain('abc123');
  });
});
