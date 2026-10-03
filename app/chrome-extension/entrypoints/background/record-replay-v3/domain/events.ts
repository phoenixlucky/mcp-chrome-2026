/**
 * @fileoverview Event type definitions
 * @description Defines run events and statuses used in Record-Replay V3
 */

import type { JsonObject, JsonValue, UnixMillis } from './json';
import type { EdgeLabel, FlowId, NodeId, RunId } from './ids';
import type { RRError } from './errors';
import type { TriggerFireContext } from './triggers';

/** Unsubscribe function type */
export type Unsubscribe = () => void;

/** Run status */
export type RunStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled';

/**
 * Event base interface
 * @description Common fields of all events
 */
export interface EventBase {
  /** Owning Run ID */
  runId: RunId;
  /** Event timestamp */
  ts: UnixMillis;
  /** Monotonically increasing sequence number */
  seq: number;
}

/**
 * Pause reason
 * @description Describes why a Run was paused
 */
export type PauseReason =
  | { kind: 'breakpoint'; nodeId: NodeId }
  | { kind: 'step'; nodeId: NodeId }
  | { kind: 'command' }
  | { kind: 'policy'; nodeId: NodeId; reason: string };

/** Recovery reason */
export type RecoveryReason = 'sw_restart' | 'lease_expired';

/**
 * Run event union type
 * @description All possible runtime events
 */
export type RunEvent =
  // ===== Run lifecycle events =====
  | (EventBase & { type: 'run.queued'; flowId: FlowId })
  | (EventBase & { type: 'run.started'; flowId: FlowId; tabId: number })
  | (EventBase & { type: 'run.paused'; reason: PauseReason; nodeId?: NodeId })
  | (EventBase & { type: 'run.resumed' })
  | (EventBase & {
      type: 'run.recovered';
      /** Recovery reason */
      reason: RecoveryReason;
      /** Status before recovery */
      fromStatus: 'running' | 'paused';
      /** Status after recovery */
      toStatus: 'queued';
      /** Previous ownerId (for audit) */
      prevOwnerId?: string;
    })
  | (EventBase & { type: 'run.canceled'; reason?: string })
  | (EventBase & { type: 'run.succeeded'; tookMs: number; outputs?: JsonObject })
  | (EventBase & { type: 'run.failed'; error: RRError; nodeId?: NodeId })

  // ===== Node execution events =====
  | (EventBase & { type: 'node.queued'; nodeId: NodeId })
  | (EventBase & { type: 'node.started'; nodeId: NodeId; attempt: number })
  | (EventBase & {
      type: 'node.succeeded';
      nodeId: NodeId;
      tookMs: number;
      next?: { kind: 'edgeLabel'; label: EdgeLabel } | { kind: 'end' };
    })
  | (EventBase & {
      type: 'node.failed';
      nodeId: NodeId;
      attempt: number;
      error: RRError;
      decision: 'retry' | 'continue' | 'stop' | 'goto';
    })
  | (EventBase & { type: 'node.skipped'; nodeId: NodeId; reason: 'disabled' | 'unreachable' })

  // ===== Variable and log events =====
  | (EventBase & {
      type: 'vars.patch';
      patch: Array<{ op: 'set' | 'delete'; name: string; value?: JsonValue }>;
    })
  | (EventBase & { type: 'artifact.screenshot'; nodeId: NodeId; data: string; savedAs?: string })
  | (EventBase & {
      type: 'log';
      level: 'debug' | 'info' | 'warn' | 'error';
      message: string;
      data?: JsonValue;
    });

/** Run event type (extracted from the union type) */
export type RunEventType = RunEvent['type'];

/**
 * Distributive Omit (preserves union types)
 */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/**
 * Run event input type
 * @description seq must be allocated atomically by the storage layer (via RunRecordV3.nextSeq)
 * ts is optional, defaults to Date.now()
 */
export type RunEventInput = DistributiveOmit<RunEvent, 'seq' | 'ts'> & {
  ts?: UnixMillis;
};

/** Run Schema version */
export const RUN_SCHEMA_VERSION = 3 as const;

/**
 * Run record V3
 * @description Run summary record stored in IndexedDB
 */
export interface RunRecordV3 {
  /** Schema version */
  schemaVersion: typeof RUN_SCHEMA_VERSION;
  /** Unique Run identifier */
  id: RunId;
  /** Associated Flow ID */
  flowId: FlowId;

  /** Current status */
  status: RunStatus;
  /** Creation time */
  createdAt: UnixMillis;
  /** Last update time */
  updatedAt: UnixMillis;

  /** Execution start time */
  startedAt?: UnixMillis;
  /** Finish time */
  finishedAt?: UnixMillis;
  /** Total duration (milliseconds) */
  tookMs?: number;

  /** Bound Tab ID (exclusive per Run) */
  tabId?: number;
  /** Start node ID (if not the default entry) */
  startNodeId?: NodeId;
  /** Current execution node ID */
  currentNodeId?: NodeId;

  /** Current attempt count */
  attempt: number;
  /** Max attempt count */
  maxAttempts: number;

  /** Run args */
  args?: JsonObject;
  /** Trigger context */
  trigger?: TriggerFireContext;
  /** Debug config */
  debug?: { breakpoints?: NodeId[]; pauseOnStart?: boolean };

  /** Error info (if failed) */
  error?: RRError;
  /** Output results */
  outputs?: JsonObject;

  /** Next event sequence number (cached field) */
  nextSeq: number;
}

/**
 * Determine whether a Run is terminal
 */
export function isTerminalStatus(status: RunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

/**
 * Determine whether a Run is active
 */
export function isActiveStatus(status: RunStatus): boolean {
  return status === 'running' || status === 'paused';
}
