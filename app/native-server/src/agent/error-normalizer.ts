import type { AgentErrorCategory, AgentErrorInfo, AgentExecutionPhase } from './types';

export interface AgentErrorContext {
  phase?: AgentExecutionPhase;
  category?: AgentErrorCategory;
  code?: string;
  requestId?: string;
  sessionId?: string;
  toolName?: string;
}

const DEFAULT_PHASE: AgentExecutionPhase = 'model';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function sanitizeTechnicalMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\b(?:sk|rk)-[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function isCancellation(message: string): boolean {
  return /cancel(?:led|lation)?|aborted|aborterror/i.test(message);
}

function isTimeout(message: string): boolean {
  return /timeout|timed out|deadline exceeded/i.test(message);
}

function isConnectionFailure(message: string): boolean {
  return /fetch failed|network|econnrefused|econnreset|enotfound|socket|connection|503|502|504/i.test(
    message,
  );
}

function isAuthenticationFailure(message: string): boolean {
  return /unauthorized|forbidden|invalid (?:api[_ -]?key|token)|authentication|permission denied/i.test(
    message,
  );
}

function isRequestFailure(message: string): boolean {
  return /instruction is required|projectid is required|project not found|session not found|does not belong|no agent engine registered|invalid (?:request|attachment|project|filename)/i.test(
    message,
  );
}

function isTransientEngineFailure(message: string): boolean {
  return /\b(?:429|500|502|503|504)\b|rate limit|temporarily unavailable|overloaded|try again/i.test(
    message,
  );
}

function defaultUserMessage(category: AgentErrorCategory, phase: AgentExecutionPhase): string {
  switch (category) {
    case 'connection':
      return 'Unable to connect to the local agent service';
    case 'request':
      return 'The request could not be submitted';
    case 'tool':
      return 'A tool failed while completing the request';
    case 'timeout':
      return 'The request took too long to complete';
    case 'cancelled':
      return 'Request cancelled';
    case 'engine':
      return phase === 'stream'
        ? 'The agent connection was interrupted'
        : 'The AI provider could not complete the request';
    default:
      return 'The agent request failed';
  }
}

function inferCategory(message: string, context: AgentErrorContext): AgentErrorCategory {
  if (context.category) return context.category;
  if (isCancellation(message)) return 'cancelled';
  if (isTimeout(message)) return 'timeout';
  if (context.phase === 'tool') return 'tool';
  if (isRequestFailure(message)) return 'request';
  if (isConnectionFailure(message)) return 'connection';
  if (
    isAuthenticationFailure(message) ||
    /engine|provider|claude|codex|deepseek|api/i.test(message)
  ) {
    return 'engine';
  }
  return 'unknown';
}

function isRetryable(category: AgentErrorCategory, message: string): boolean {
  switch (category) {
    case 'connection':
    case 'timeout':
      return true;
    case 'engine':
      return isTransientEngineFailure(message) && !isAuthenticationFailure(message);
    default:
      return false;
  }
}

export function normalizeAgentError(
  error: unknown,
  context: AgentErrorContext = {},
): AgentErrorInfo {
  const message = getErrorMessage(error) || 'Unknown agent error';
  const phase = context.phase ?? DEFAULT_PHASE;
  const category = inferCategory(message, context);

  return {
    category,
    phase,
    userMessage:
      category === 'engine' && isAuthenticationFailure(message)
        ? 'The AI provider authentication failed'
        : defaultUserMessage(category, phase),
    technicalMessage: sanitizeTechnicalMessage(message),
    retryable: isRetryable(category, message),
    ...(context.code ? { code: context.code } : {}),
    ...(context.requestId ? { requestId: context.requestId } : {}),
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context.toolName ? { toolName: context.toolName } : {}),
  };
}
