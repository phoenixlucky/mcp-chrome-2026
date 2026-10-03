/**
 * @fileoverview StoragePort interface definition
 * @description Defines the abstract Storage layer interface for dependency injection
 */

import type { FlowId, RunId, TriggerId } from '../../domain/ids';
import type { FlowV3 } from '../../domain/flow';
import type { RunEvent, RunEventInput, RunRecordV3 } from '../../domain/events';
import type { PersistentVarRecord, PersistentVariableName } from '../../domain/variables';
import type { TriggerSpec } from '../../domain/triggers';
import type { RunQueue } from '../queue/queue';

/**
 * FlowsStore interface
 */
export interface FlowsStore {
  /** List all Flows */
  list(): Promise<FlowV3[]>;
  /** Get a single Flow */
  get(id: FlowId): Promise<FlowV3 | null>;
  /** Save a Flow */
  save(flow: FlowV3): Promise<void>;
  /** Delete a Flow */
  delete(id: FlowId): Promise<void>;
}

/**
 * RunsStore interface
 */
export interface RunsStore {
  /** List all Run records */
  list(): Promise<RunRecordV3[]>;
  /** Get a single Run record */
  get(id: RunId): Promise<RunRecordV3 | null>;
  /** Save a Run record */
  save(record: RunRecordV3): Promise<void>;
  /** Partially update a Run record */
  patch(id: RunId, patch: Partial<RunRecordV3>): Promise<void>;
}

/**
 * EventsStore interface
 * @description seq allocation MUST be done atomically inside append()
 */
export interface EventsStore {
  /**
   * Append an event and allocate seq atomically
   * @description In a single transaction: read RunRecordV3.nextSeq -> write the event -> increment nextSeq
   * @param event Event input (without seq)
   * @returns Full event (with allocated seq and ts)
   */
  append(event: RunEventInput): Promise<RunEvent>;

  /**
   * List events
   * @param runId Run ID
   * @param opts Query options
   */
  list(runId: RunId, opts?: { fromSeq?: number; limit?: number }): Promise<RunEvent[]>;
}

/**
 * PersistentVarsStore interface
 */
export interface PersistentVarsStore {
  /** Get a persistent variable */
  get(key: PersistentVariableName): Promise<PersistentVarRecord | undefined>;
  /** Set a persistent variable */
  set(
    key: PersistentVariableName,
    value: PersistentVarRecord['value'],
  ): Promise<PersistentVarRecord>;
  /** Delete a persistent variable */
  delete(key: PersistentVariableName): Promise<void>;
  /** List persistent variables */
  list(prefix?: PersistentVariableName): Promise<PersistentVarRecord[]>;
}

/**
 * TriggersStore interface
 */
export interface TriggersStore {
  /** List all triggers */
  list(): Promise<TriggerSpec[]>;
  /** Get a single trigger */
  get(id: TriggerId): Promise<TriggerSpec | null>;
  /** Save a trigger */
  save(spec: TriggerSpec): Promise<void>;
  /** Delete a trigger */
  delete(id: TriggerId): Promise<void>;
}

/**
 * StoragePort interface
 * @description Aggregates all storage interfaces for dependency injection
 */
export interface StoragePort {
  /** Flows storage */
  flows: FlowsStore;
  /** Runs storage */
  runs: RunsStore;
  /** Events storage */
  events: EventsStore;
  /** Queue storage */
  queue: RunQueue;
  /** Persistent variables storage */
  persistentVars: PersistentVarsStore;
  /** Triggers storage */
  triggers: TriggersStore;
}

/**
 * Create a NotImplemented Store
 * @description Avoids Proxy-producing 'then' causing thenable behavior
 */
function createNotImplementedStore<T extends object>(name: string): T {
  const target = {} as T;
  return new Proxy(target, {
    get(_, prop) {
      // Avoid thenable behavior by returning undefined for 'then'
      if (prop === 'then') {
        return undefined;
      }
      return async () => {
        throw new Error(`${name}.${String(prop)} not implemented`);
      };
    },
  });
}

/**
 * Create a NotImplemented StoragePort
 * @description Phase 0 placeholder implementation
 */
export function createNotImplementedStoragePort(): StoragePort {
  return {
    flows: createNotImplementedStore<FlowsStore>('FlowsStore'),
    runs: createNotImplementedStore<RunsStore>('RunsStore'),
    events: createNotImplementedStore<EventsStore>('EventsStore'),
    queue: createNotImplementedStore<RunQueue>('RunQueue'),
    persistentVars: createNotImplementedStore<PersistentVarsStore>('PersistentVarsStore'),
    triggers: createNotImplementedStore<TriggersStore>('TriggersStore'),
  };
}
