import type {
  RuntimeTaskEvent,
  RuntimeTaskEventType,
  RuntimeTaskKind,
  RuntimeTaskStatus,
  RuntimeTaskSummary,
} from '@ethanwilkins/chrome-mcp-shared-2026';

const MAX_EVENTS = 200;
const MAX_HISTORY = 200;
const TERMINAL = new Set<RuntimeTaskStatus>(['success', 'error', 'cancelled', 'unknown']);

export interface RuntimeTaskInput {
  taskId: string;
  kind: RuntimeTaskKind;
  label: string;
  clientName?: string | null;
  sessionId?: string | null;
  toolName?: string | null;
  tabId?: number | null;
  profileId?: string | null;
  origin?: string | null;
  cancelable?: boolean;
  pausable?: boolean;
}

export interface RuntimeTaskRecord {
  summary: RuntimeTaskSummary;
  events: RuntimeTaskEvent[];
}

function safeOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.origin === 'null' ? null : url.origin;
  } catch {
    return null;
  }
}

function safeMessage(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  return value.replace(/https?:\/\/[^\s]+/gi, '[URL]').slice(0, 240);
}

export class RuntimeRegistry {
  private readonly records = new Map<string, RuntimeTaskRecord>();

  start(input: RuntimeTaskInput): RuntimeTaskSummary {
    const now = new Date().toISOString();
    const summary: RuntimeTaskSummary = {
      taskId: input.taskId,
      kind: input.kind,
      label: input.label.slice(0, 120),
      clientName: input.clientName ?? null,
      sessionId: input.sessionId ?? null,
      toolName: input.toolName ?? null,
      tabId: input.tabId ?? null,
      profileId: input.profileId ?? null,
      origin: safeOrigin(input.origin),
      startedAt: now,
      updatedAt: now,
      elapsedMs: 0,
      status: 'running',
      cancelable: input.cancelable ?? true,
      pausable: input.pausable ?? false,
      errorCategory: null,
      errorMessage: null,
    };
    const record = { summary, events: [] } satisfies RuntimeTaskRecord;
    this.records.set(input.taskId, record);
    this.appendEvent(input.taskId, 'started', 'running');
    this.trimHistory();
    return summary;
  }

  update(
    taskId: string,
    status: RuntimeTaskStatus,
    eventType?: RuntimeTaskEventType,
    details: Partial<
      Pick<RuntimeTaskSummary, 'toolName' | 'tabId' | 'origin' | 'errorCategory' | 'errorMessage'>
    > & {
      message?: string | null;
    } = {},
  ): RuntimeTaskSummary | null {
    const record = this.records.get(taskId);
    if (!record) return null;
    const { message: eventMessage, ...summaryDetails } = details;
    const now = new Date();
    const started = new Date(record.summary.startedAt).getTime();
    record.summary = {
      ...record.summary,
      ...summaryDetails,
      origin:
        summaryDetails.origin === undefined
          ? record.summary.origin
          : safeOrigin(summaryDetails.origin),
      errorMessage:
        summaryDetails.errorMessage === undefined
          ? record.summary.errorMessage
          : safeMessage(summaryDetails.errorMessage),
      status,
      updatedAt: now.toISOString(),
      elapsedMs: Math.max(0, now.getTime() - started),
    };
    if (eventType)
      this.appendEvent(taskId, eventType, status, eventMessage ?? details.errorMessage);
    return record.summary;
  }

  finish(
    taskId: string,
    status: Extract<RuntimeTaskStatus, 'success' | 'error' | 'cancelled' | 'unknown'>,
    message?: string,
  ): RuntimeTaskSummary | null {
    return this.update(taskId, status, status === 'error' ? 'error' : 'finished', {
      errorMessage: status === 'error' || status === 'unknown' ? message : null,
      message,
    });
  }

  get(taskId: string): RuntimeTaskRecord | null {
    const record = this.records.get(taskId);
    return record ? { summary: { ...record.summary }, events: record.events.slice() } : null;
  }

  list(): RuntimeTaskRecord[] {
    const now = Date.now();
    return [...this.records.values()]
      .map((record) => ({
        summary: {
          ...record.summary,
          elapsedMs: TERMINAL.has(record.summary.status)
            ? record.summary.elapsedMs
            : Math.max(0, now - new Date(record.summary.startedAt).getTime()),
        },
        events: record.events.slice(),
      }))
      .sort((a, b) => b.summary.updatedAt.localeCompare(a.summary.updatedAt));
  }

  active(kind?: RuntimeTaskKind): RuntimeTaskRecord[] {
    return this.list().filter(
      (record) =>
        (!kind || record.summary.kind === kind) &&
        ['running', 'waiting', 'paused', 'cancelling'].includes(record.summary.status),
    );
  }

  private appendEvent(
    taskId: string,
    type: RuntimeTaskEventType,
    status: RuntimeTaskStatus,
    message?: string | null,
  ): void {
    const record = this.records.get(taskId);
    if (!record) return;
    const event: RuntimeTaskEvent = {
      type,
      at: new Date().toISOString(),
      taskId,
      status,
      toolName: record.summary.toolName,
      tabId: record.summary.tabId,
      origin: record.summary.origin,
      elapsedMs: record.summary.elapsedMs,
      message: safeMessage(message),
    };
    record.events.push(event);
    if (record.events.length > MAX_EVENTS)
      record.events.splice(0, record.events.length - MAX_EVENTS);
  }

  private trimHistory(): void {
    if (this.records.size <= MAX_HISTORY) return;
    const terminal = [...this.records.values()]
      .filter((record) => TERMINAL.has(record.summary.status))
      .sort((a, b) => a.summary.updatedAt.localeCompare(b.summary.updatedAt));
    while (this.records.size > MAX_HISTORY && terminal.length) {
      this.records.delete(terminal.shift()!.summary.taskId);
    }
  }
}
