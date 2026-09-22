import { describe, expect, it } from 'vitest';
import {
  createFallbackAgentError,
  formatAgentDiagnostics,
  parseAgentErrorInfo,
} from '@/entrypoints/sidepanel/composables/agent-error';

describe('agent error presentation helpers', () => {
  it('prefers structured server errors while keeping legacy messages as fallback', () => {
    const result = parseAgentErrorInfo(
      {
        error: 'legacy failure',
        errorInfo: {
          category: 'timeout',
          phase: 'model',
          userMessage: 'The request timed out',
          retryable: true,
          requestId: 'req-1',
        },
      },
      'fallback',
    );

    expect(result).toMatchObject({
      category: 'timeout',
      userMessage: 'The request timed out',
      retryable: true,
      requestId: 'req-1',
    });
  });

  it('creates a stream fallback that is not accidentally retryable', () => {
    expect(createFallbackAgentError('stream disconnected')).toMatchObject({
      category: 'unknown',
      phase: 'stream',
      userMessage: 'stream disconnected',
      retryable: false,
    });
  });

  it('formats safe copyable diagnostics without leaking raw payloads', () => {
    const info = createFallbackAgentError('request failed', {
      requestId: 'req-2',
      technicalMessage: 'Bearer [REDACTED]',
    });

    const diagnostics = formatAgentDiagnostics(info);
    expect(diagnostics).toContain('requestId=req-2');
    expect(diagnostics).toContain('[REDACTED]');
    expect(diagnostics).not.toContain('undefined');
  });
});
