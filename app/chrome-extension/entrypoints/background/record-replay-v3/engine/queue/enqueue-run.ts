/**
 * @fileoverview Shared enqueue service
 * @description
 * Provides unified Run enqueueing logic shared by RpcServer and TriggerManager.
 *
 * Design rationale:
 * - Extracts the enqueue logic formerly in RpcServer into a standalone service
 * - Avoids behavior drift between RPC and TriggerManager
 * - Unifies parameter validation, Run creation, queueing and event publishing
 */

import type { JsonObject, UnixMillis } from '../../domain/json';
import type { FlowId, NodeId, RunId } from '../../domain/ids';
import type { TriggerFireContext } from '../../domain/triggers';
import { RUN_SCHEMA_VERSION, type RunRecordV3 } from '../../domain/events';
import type { StoragePort } from '../storage/storage-port';
import type { EventsBus } from '../transport/events-bus';
import type { RunScheduler } from './scheduler';

// ==================== Types ====================

/**
 * Enqueue service dependencies
 */
export interface EnqueueRunDeps {
  /** Storage layer (only flows/runs/queue needed) */
  storage: Pick<StoragePort, 'flows' | 'runs' | 'queue'>;
  /** Event bus */
  events: Pick<EventsBus, 'append'>;
  /** Scheduler (optional) */
  scheduler?: Pick<RunScheduler, 'kick'>;
  /** RunId generator (for test injection) */
  generateRunId?: () => RunId;
  /** Time source (for test injection) */
  now?: () => UnixMillis;
}

/**
 * Enqueue request params
 */
export interface EnqueueRunInput {
  /** Flow ID (required) */
  flowId: FlowId;
  /** Start node ID (optional, defaults to the Flow's entryNodeId) */
  startNodeId?: NodeId;
  /** Priority (default 0) */
  priority?: number;
  /** Max attempt count (default 1) */
  maxAttempts?: number;
  /** Args passed to the Flow */
  args?: JsonObject;
  /** Trigger context (set by TriggerManager) */
  trigger?: TriggerFireContext;
  /** Debug options */
  debug?: {
    breakpoints?: NodeId[];
    pauseOnStart?: boolean;
  };
  /** Current page Tab; a temporary page is created only when not provided */
  tabId?: number;
}

/**
 * Enqueue result
 */
export interface EnqueueRunResult {
  /** Newly created Run ID */
  runId: RunId;
  /** Position in the queue (1-based) */
  position: number;
}

// ==================== Utilities ====================

/**
 * Default RunId generator
 */
function defaultGenerateRunId(): RunId {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate an integer parameter
 */
function validateInt(
  value: unknown,
  defaultValue: number,
  fieldName: string,
  opts?: { min?: number; max?: number },
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  const intValue = Math.floor(value);
  if (opts?.min !== undefined && intValue < opts.min) {
    throw new Error(`${fieldName} must be >= ${opts.min}`);
  }
  if (opts?.max !== undefined && intValue > opts.max) {
    throw new Error(`${fieldName} must be <= ${opts.max}`);
  }
  return intValue;
}

/**
 * Compute the Run's position in the queue
 * @description Ordered by scheduling order: priority DESC + createdAt ASC
 * @returns 1-based position, or -1 if the run is not found in queued items
 *
 * Note: Due to race conditions (scheduler may claim the run before this is called),
 * position may be -1. Callers should handle this gracefully.
 */
async function computeQueuePosition(
  storage: Pick<StoragePort, 'queue'>,
  runId: RunId,
): Promise<number> {
  const queueItems = await storage.queue.list('queued');
  queueItems.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.createdAt - b.createdAt;
  });
  const index = queueItems.findIndex((item) => item.id === runId);
  // Return -1 if not found (run may have been claimed already)
  return index === -1 ? -1 : index + 1;
}

// ==================== Main Function ====================

/**
 * Enqueue and execute a Run
 * @description
 * Steps:
 * 1. Parameter validation
 * 2. Verify the Flow exists
 * 3. Create RunRecordV3 (status=queued)
 * 4. Enqueue into RunQueue
 * 5. Publish a run.queued event
 * 6. Kick the scheduler (best-effort)
 * 7. Compute the queue position
 */
export async function enqueueRun(
  deps: EnqueueRunDeps,
  input: EnqueueRunInput,
): Promise<EnqueueRunResult> {
  const { flowId } = input;
  if (!flowId) {
    throw new Error('flowId is required');
  }

  const now = deps.now ?? (() => Date.now());
  const generateRunId = deps.generateRunId ?? defaultGenerateRunId;

  // Parameter validation
  const priority = validateInt(input.priority, 0, 'priority');
  const maxAttempts = validateInt(input.maxAttempts, 1, 'maxAttempts', { min: 1 });
  const tabId =
    input.tabId === undefined ? undefined : validateInt(input.tabId, 0, 'tabId', { min: 0 });

  // Verify the Flow exists
  const flow = await deps.storage.flows.get(flowId);
  if (!flow) {
    throw new Error(`Flow "${flowId}" not found`);
  }

  // Verify that startNodeId exists in the Flow
  if (input.startNodeId) {
    const nodeExists = flow.nodes.some((n) => n.id === input.startNodeId);
    if (!nodeExists) {
      throw new Error(`startNodeId "${input.startNodeId}" not found in flow "${flowId}"`);
    }
  }

  const ts = now();
  const runId = generateRunId();

  // 1. Create RunRecordV3
  const runRecord: RunRecordV3 = {
    schemaVersion: RUN_SCHEMA_VERSION,
    id: runId,
    flowId,
    status: 'queued',
    createdAt: ts,
    updatedAt: ts,
    attempt: 0,
    maxAttempts,
    args: input.args,
    trigger: input.trigger,
    debug: input.debug,
    tabId,
    startNodeId: input.startNodeId,
    nextSeq: 0,
  };
  await deps.storage.runs.save(runRecord);

  // 2. Enqueue
  await deps.storage.queue.enqueue({
    id: runId,
    flowId,
    priority,
    maxAttempts,
    args: input.args,
    trigger: input.trigger,
    debug: input.debug,
    tabId,
  });

  // 3. Publish a run.queued event
  await deps.events.append({
    runId,
    type: 'run.queued',
    flowId,
  });

  // 4. Compute the queue position (before kick, to reduce the chance of a racy position=-1)
  const position = await computeQueuePosition(deps.storage, runId);

  // 5. Kick the scheduler (best-effort, does not block the return)
  if (deps.scheduler) {
    void deps.scheduler.kick();
  }

  return { runId, position };
}
