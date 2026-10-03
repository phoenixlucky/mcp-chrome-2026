/**
 * @fileoverview Trigger manager
 * @description
 * TriggerManager manages the lifecycle of all trigger Handlers:
 * - Loads triggers from TriggerStore and installs them
 * - Handles trigger fire events, invoking enqueueRun
 * - Provides storm control (cooldown + maxQueued)
 *
 * Design rationale:
 * - Orchestrator pattern: TriggerManager does not implement per-kind trigger logic directly,
 *   but delegates to per-kind Handlers
 * - Handler factory pattern: TriggerManager creates Handler instances at construction and
 *   injects fireCallback
 * - Storm control: cooldown (per-trigger) + maxQueued (global best-effort)
 */

import type { UnixMillis } from '../../domain/json';
import type { RunId, TriggerId } from '../../domain/ids';
import type { TriggerFireContext, TriggerKind, TriggerSpec } from '../../domain/triggers';
import type { StoragePort } from '../storage/storage-port';
import type { EventsBus } from '../transport/events-bus';
import type { RunScheduler } from '../queue/scheduler';
import { enqueueRun, type EnqueueRunResult } from '../queue/enqueue-run';
import type { TriggerFireCallback, TriggerHandler, TriggerHandlerFactory } from './trigger-handler';

// ==================== Types ====================

/**
 * Handler factory map
 */
// The factory map is dynamically indexed by trigger kind, so its key/value correlation
// cannot survive Object.entries() at runtime.
export type TriggerHandlerFactories = Partial<Record<TriggerKind, TriggerHandlerFactory<any>>>;

/**
 * Storm control config
 */
export interface TriggerManagerStormControl {
  /**
   * Minimum interval between two fires of the same trigger (ms)
   * - 0 or undefined disables cooldown
   */
  cooldownMs?: number;

  /**
   * Global max queued Run count
   * - New fires are rejected once the limit is reached
   * - undefined disables the limit check
   * - Note: this is a best-effort check, not atomic
   */
  maxQueued?: number;
}

/**
 * TriggerManager dependencies
 */
export interface TriggerManagerDeps {
  /** Storage layer */
  storage: Pick<StoragePort, 'triggers' | 'flows' | 'runs' | 'queue'>;
  /** Event bus */
  events: Pick<EventsBus, 'append'>;
  /** Scheduler (optional) */
  scheduler?: Pick<RunScheduler, 'kick'>;
  /** Handler factory map */
  handlerFactories: TriggerHandlerFactories;
  /** Storm control config */
  storm?: TriggerManagerStormControl;
  /** RunId generator (for test injection) */
  generateRunId?: () => RunId;
  /** Time source (for test injection) */
  now?: () => UnixMillis;
  /** Logger */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

/**
 * TriggerManager state
 */
export interface TriggerManagerState {
  /** Whether started */
  started: boolean;
  /** List of installed trigger IDs */
  installedTriggerIds: TriggerId[];
}

/**
 * TriggerManager interface
 */
export interface TriggerManager {
  /** Start the manager, loading and installing all enabled triggers */
  start(): Promise<void>;
  /** Stop the manager, uninstalling all triggers */
  stop(): Promise<void>;
  /** Refresh triggers, reloading and reinstalling from storage */
  refresh(): Promise<void>;
  /**
   * Manually fire a trigger
   * @description Only for RPC/UI calls, used with manual triggers
   */
  fire(
    triggerId: TriggerId,
    context?: { sourceTabId?: number; sourceUrl?: string },
  ): Promise<EnqueueRunResult>;
  /** Dispose the manager */
  dispose(): Promise<void>;
  /** Get the current state */
  getState(): TriggerManagerState;
}

// ==================== Utilities ====================

/**
 * Validate a non-negative integer
 */
function normalizeNonNegativeInt(value: unknown, fallback: number, fieldName: string): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  return Math.max(0, Math.floor(value));
}

/**
 * Validate a positive integer
 */
function normalizePositiveInt(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  const intValue = Math.floor(value);
  if (intValue < 1) {
    throw new Error(`${fieldName} must be >= 1`);
  }
  return intValue;
}

// ==================== Implementation ====================

/**
 * Create the TriggerManager
 */
export function createTriggerManager(deps: TriggerManagerDeps): TriggerManager {
  const logger = deps.logger ?? console;
  const now = deps.now ?? (() => Date.now());

  // Storm control parameters
  const cooldownMs = normalizeNonNegativeInt(deps.storm?.cooldownMs, 0, 'storm.cooldownMs');
  const maxQueued =
    deps.storm?.maxQueued === undefined || deps.storm?.maxQueued === null
      ? undefined
      : normalizePositiveInt(deps.storm.maxQueued, 'storm.maxQueued');

  // State
  const installed = new Map<TriggerId, TriggerSpec>();
  const lastFireAt = new Map<TriggerId, UnixMillis>();
  let started = false;
  let inFlightEnqueues = 0;

  // Prevent refresh re-entry
  let refreshPromise: Promise<void> | null = null;
  let pendingRefresh = false;

  // Handler instances
  const handlers = new Map<TriggerKind, TriggerHandler<any>>();

  // Fire callback
  const fireCallback: TriggerFireCallback = {
    onFire: async (triggerId, context) => {
      // Catch all exceptions to avoid throwing into chrome API listeners
      try {
        await handleFire(triggerId as TriggerId, context);
      } catch (e) {
        logger.error('[TriggerManager] onFire failed:', e);
      }
    },
  };

  // Initialize Handler instances
  for (const [kind, factory] of Object.entries(deps.handlerFactories) as Array<
    [TriggerKind, TriggerHandlerFactory<any> | undefined]
  >) {
    if (!factory) continue; // Skip undefined factory values

    const handler = factory(fireCallback) as TriggerHandler<TriggerKind>;
    if (handler.kind !== kind) {
      throw new Error(
        `[TriggerManager] Handler kind mismatch: factory key is "${kind}", but handler.kind is "${handler.kind}"`,
      );
    }
    handlers.set(kind, handler);
  }

  /**
   * Handle a trigger fire (internal method)
   * @param throwOnDrop If true, throws on cooldown/maxQueued drops
   * @returns EnqueueRunResult or null (silently dropped)
   */
  async function handleFire(
    triggerId: TriggerId,
    context: { sourceTabId?: number; sourceUrl?: string },
    options?: { throwOnDrop?: boolean },
  ): Promise<EnqueueRunResult | null> {
    if (!started) {
      if (options?.throwOnDrop) {
        throw new Error('TriggerManager is not started');
      }
      return null;
    }

    const trigger = installed.get(triggerId);
    if (!trigger) {
      if (options?.throwOnDrop) {
        throw new Error(`Trigger "${triggerId}" is not installed`);
      }
      return null;
    }

    const t = now();

    // Per-trigger cooldown check
    const prevLastFireAt = lastFireAt.get(triggerId);
    if (cooldownMs > 0 && prevLastFireAt !== undefined && t - prevLastFireAt < cooldownMs) {
      logger.debug(`[TriggerManager] Dropping trigger "${triggerId}" (cooldown ${cooldownMs}ms)`);
      if (options?.throwOnDrop) {
        throw new Error(`Trigger "${triggerId}" dropped (cooldown ${cooldownMs}ms)`);
      }
      return null;
    }

    // Global maxQueued check (best-effort)
    // Note: check before setting cooldown, so a maxQueued drop does not falsely set cooldown
    if (maxQueued !== undefined) {
      const queued = await deps.storage.queue.list('queued');
      if (queued.length + inFlightEnqueues >= maxQueued) {
        logger.warn(
          `[TriggerManager] Dropping trigger "${triggerId}" (queued=${queued.length}, inFlight=${inFlightEnqueues}, maxQueued=${maxQueued})`,
        );
        if (options?.throwOnDrop) {
          throw new Error(`Trigger "${triggerId}" dropped (maxQueued=${maxQueued})`);
        }
        return null;
      }
    }

    // Set lastFireAt to suppress concurrent fires (after the maxQueued check passes)
    if (cooldownMs > 0) {
      lastFireAt.set(triggerId, t);
    }

    // Build the trigger context
    const triggerContext: TriggerFireContext = {
      triggerId: trigger.id,
      kind: trigger.kind,
      firedAt: t,
      sourceTabId: context.sourceTabId,
      sourceUrl: context.sourceUrl,
    };

    inFlightEnqueues += 1;
    try {
      const result = await enqueueRun(
        {
          storage: deps.storage,
          events: deps.events,
          scheduler: deps.scheduler,
          generateRunId: deps.generateRunId,
          now,
        },
        {
          flowId: trigger.flowId,
          args: trigger.args,
          trigger: triggerContext,
        },
      );
      return result;
    } catch (e) {
      // Roll back the cooldown marker when enqueueing fails
      if (cooldownMs > 0) {
        if (prevLastFireAt === undefined) {
          lastFireAt.delete(triggerId);
        } else {
          lastFireAt.set(triggerId, prevLastFireAt);
        }
      }
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[TriggerManager] enqueueRun failed for trigger "${triggerId}":`, e);
      if (options?.throwOnDrop) {
        throw new Error(`enqueueRun failed for trigger "${triggerId}": ${msg}`);
      }
      return null;
    } finally {
      inFlightEnqueues -= 1;
    }
  }

  /**
   * Manually fire a trigger (public)
   * @description For RPC/UI calls; throws instead of silently dropping
   */
  async function fire(
    triggerId: TriggerId,
    context: { sourceTabId?: number; sourceUrl?: string } = {},
  ): Promise<EnqueueRunResult> {
    const result = await handleFire(triggerId, context, { throwOnDrop: true });
    if (!result) {
      throw new Error(`Trigger "${triggerId}" did not enqueue a run`);
    }
    return result;
  }

  /**
   * Perform the refresh
   */
  async function doRefresh(): Promise<void> {
    const triggers = await deps.storage.triggers.list();
    if (!started) return;

    // Uninstall all first, then reinstall (simple strategy, ensures consistency)
    // Best-effort: a single handler uninstall failure does not affect others
    for (const handler of handlers.values()) {
      try {
        await handler.uninstallAll();
      } catch (e) {
        logger.warn(`[TriggerManager] Error during uninstallAll for kind "${handler.kind}":`, e);
      }
    }
    installed.clear();

    // Install enabled triggers
    for (const trigger of triggers) {
      if (!started) return;
      if (!trigger.enabled) continue;

      const handler = handlers.get(trigger.kind);
      if (!handler) {
        logger.warn(`[TriggerManager] No handler registered for kind "${trigger.kind}"`);
        continue;
      }

      try {
        await handler.install(trigger as Parameters<typeof handler.install>[0]);
        installed.set(trigger.id, trigger);
      } catch (e) {
        logger.error(`[TriggerManager] Failed to install trigger "${trigger.id}":`, e);
      }
    }
  }

  /**
   * Refresh triggers (merges concurrent calls)
   */
  async function refresh(): Promise<void> {
    if (!started) {
      throw new Error('TriggerManager is not started');
    }

    pendingRefresh = true;
    if (!refreshPromise) {
      refreshPromise = (async () => {
        while (started && pendingRefresh) {
          pendingRefresh = false;
          await doRefresh();
        }
      })().finally(() => {
        refreshPromise = null;
      });
    }

    return refreshPromise;
  }

  /**
   * Start the manager
   */
  async function start(): Promise<void> {
    if (started) return;
    started = true;
    await refresh();
  }

  /**
   * Stop the manager
   */
  async function stop(): Promise<void> {
    if (!started) return;

    started = false;
    pendingRefresh = false;

    // Wait for an in-flight refresh to finish
    if (refreshPromise) {
      try {
        await refreshPromise;
      } catch {
        // Ignore refresh errors
      }
    }

    // Uninstall all triggers
    for (const handler of handlers.values()) {
      try {
        await handler.uninstallAll();
      } catch (e) {
        logger.warn('[TriggerManager] Error uninstalling handler:', e);
      }
    }
    installed.clear();
    lastFireAt.clear();
  }

  /**
   * Dispose the manager
   */
  async function dispose(): Promise<void> {
    await stop();
  }

  /**
   * Get the state
   */
  function getState(): TriggerManagerState {
    return {
      started,
      installedTriggerIds: Array.from(installed.keys()),
    };
  }

  return { start, stop, refresh, fire, dispose, getState };
}
