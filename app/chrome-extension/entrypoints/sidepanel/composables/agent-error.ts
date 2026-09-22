import type {
  AgentErrorCategory,
  AgentErrorInfo,
  AgentExecutionPhase,
} from '@ethanwilkins/chrome-mcp-shared-2026';

interface ErrorPayload {
  error?: unknown;
  errorInfo?: unknown;
  data?: { errorInfo?: unknown };
}

function isErrorCategory(value: unknown): value is AgentErrorCategory {
  return (
    value === 'connection' ||
    value === 'request' ||
    value === 'engine' ||
    value === 'tool' ||
    value === 'timeout' ||
    value === 'cancelled' ||
    value === 'unknown'
  );
}

function isExecutionPhase(value: unknown): value is AgentExecutionPhase {
  return (
    value === 'connection' ||
    value === 'dispatch' ||
    value === 'model' ||
    value === 'tool' ||
    value === 'stream' ||
    value === 'cancel'
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function createFallbackAgentError(
  message: string,
  overrides: Partial<AgentErrorInfo> = {},
): AgentErrorInfo {
  return {
    category: 'unknown',
    phase: 'stream',
    userMessage: message || 'The agent request failed',
    technicalMessage: message || undefined,
    retryable: false,
    ...overrides,
  };
}

export function parseAgentErrorInfo(payload: unknown, fallbackMessage: string): AgentErrorInfo {
  const root = asRecord(payload) as ErrorPayload | null;
  const candidate = root?.errorInfo ?? root?.data?.errorInfo;
  const record = asRecord(candidate);

  if (
    record &&
    isErrorCategory(record.category) &&
    isExecutionPhase(record.phase) &&
    typeof record.userMessage === 'string' &&
    typeof record.retryable === 'boolean'
  ) {
    return {
      category: record.category,
      phase: record.phase,
      userMessage: record.userMessage,
      technicalMessage:
        typeof record.technicalMessage === 'string' ? record.technicalMessage : undefined,
      retryable: record.retryable,
      code: typeof record.code === 'string' ? record.code : undefined,
      requestId: typeof record.requestId === 'string' ? record.requestId : undefined,
      sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined,
      toolName: typeof record.toolName === 'string' ? record.toolName : undefined,
    };
  }

  const message =
    typeof root?.error === 'string' && root.error.trim() ? root.error : fallbackMessage;
  return createFallbackAgentError(message);
}

export function formatAgentDiagnostics(info: AgentErrorInfo): string {
  const lines = [
    `category=${info.category}`,
    `phase=${info.phase}`,
    `retryable=${info.retryable}`,
    info.code ? `code=${info.code}` : null,
    info.requestId ? `requestId=${info.requestId}` : null,
    info.sessionId ? `sessionId=${info.sessionId}` : null,
    info.toolName ? `tool=${info.toolName}` : null,
    `message=${info.userMessage}`,
    info.technicalMessage ? `technical=${info.technicalMessage}` : null,
  ];
  return lines.filter((line): line is string => Boolean(line)).join('\n');
}
