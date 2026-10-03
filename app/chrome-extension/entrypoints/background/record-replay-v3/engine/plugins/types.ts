/**
 * @fileoverview Plugin type definitions
 * @description Defines node and trigger plugin interfaces used in Record-Replay V3
 */

import { z } from 'zod';

import type { JsonObject, JsonValue } from '../../domain/json';
import type { FlowId, NodeId, RunId, TriggerId } from '../../domain/ids';
import type { NodeKind } from '../../domain/flow';
import type { RRError } from '../../domain/errors';
import type { NodePolicy } from '../../domain/policy';
import type { FlowV3, NodeV3 } from '../../domain/flow';
import type { TriggerKind } from '../../domain/triggers';

/**
 * Schema type
 * @description Uses Zod for config validation
 */
export type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

/**
 * Node execution context
 * @description Runtime context provided to node executors
 */
export interface NodeExecutionContext {
  /** Run ID */
  runId: RunId;
  /** Flow definition (snapshot) */
  flow: FlowV3;
  /** Current node ID */
  nodeId: NodeId;

  /** Bound Tab ID (exclusive per Run) */
  tabId: number;
  /** Frame ID (defaults to 0, the main frame) */
  frameId?: number;

  /** Current variable table */
  vars: Record<string, JsonValue>;

  /**
   * Logging
   */
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: JsonValue) => void;

  /**
   * Choose the next edge
   * @description Used by conditional branching nodes
   */
  chooseNext: (label: string) => { kind: 'edgeLabel'; label: string };

  /** Execute a named subflow of the current Flow, sharing the variable scope with the current node. */
  executeSubflow: (
    subflowId: string,
    vars: Record<string, JsonValue>,
  ) => Promise<{ ok: true } | { ok: false; error: RRError }>;

  /**
   * Artifact operations
   */
  artifacts: {
    /** Capture a screenshot of the current page */
    screenshot: () => Promise<{ ok: true; base64: string } | { ok: false; error: RRError }>;
  };

  /**
   * Persistent variable operations
   */
  persistent: {
    /** Get a persistent variable */
    get: (name: `$${string}`) => Promise<JsonValue | undefined>;
    /** Set a persistent variable */
    set: (name: `$${string}`, value: JsonValue) => Promise<void>;
    /** Delete a persistent variable */
    delete: (name: `$${string}`) => Promise<void>;
  };
}

/**
 * Variable patch operation
 */
export interface VarsPatchOp {
  op: 'set' | 'delete';
  name: string;
  value?: JsonValue;
}

/**
 * Node execution result
 */
export type NodeExecutionResult =
  | {
      status: 'succeeded';
      /** Next execution direction */
      next?: { kind: 'edgeLabel'; label: string } | { kind: 'end' };
      /** Output results */
      outputs?: JsonObject;
      /** Variable changes */
      varsPatch?: VarsPatchOp[];
      error?: undefined;
    }
  | {
      status: 'failed';
      error: RRError;
      next?: undefined;
      outputs?: undefined;
      varsPatch?: undefined;
    };

/**
 * Node definition
 * @description Defines the execution logic of a node kind
 */
export interface NodeDefinition<
  TKind extends NodeKind = NodeKind,
  TConfig extends JsonObject = JsonObject,
> {
  /** Node kind identifier */
  kind: TKind;
  /** Config validation Schema */
  schema: Schema<TConfig>;
  /** Default policy */
  defaultPolicy?: NodePolicy;
  /**
   * Execute the node
   * @param ctx Execution context
   * @param node Node definition (with config)
   */
  execute(
    ctx: NodeExecutionContext,
    node: NodeV3 & { kind: TKind; config: TConfig },
  ): Promise<NodeExecutionResult>;
}

/**
 * Trigger install context
 */
export interface TriggerInstallContext<
  TKind extends TriggerKind = TriggerKind,
  TConfig extends JsonObject = JsonObject,
> {
  /** Trigger ID */
  triggerId: TriggerId;
  /** Trigger kind */
  kind: TKind;
  /** Whether enabled */
  enabled: boolean;
  /** Associated Flow ID */
  flowId: FlowId;
  /** Trigger config */
  config: TConfig;
  /** Args passed to the Flow */
  args?: JsonObject;
}

/**
 * Trigger definition
 * @description Defines install and uninstall logic for a trigger kind
 */
export interface TriggerDefinition<
  TKind extends TriggerKind = TriggerKind,
  TConfig extends JsonObject = JsonObject,
> {
  /** Trigger kind identifier */
  kind: TKind;
  /** Config validation Schema */
  schema: Schema<TConfig>;
  /** Install the trigger */
  install(ctx: TriggerInstallContext<TKind, TConfig>): Promise<void> | void;
  /** Uninstall the trigger */
  uninstall(ctx: TriggerInstallContext<TKind, TConfig>): Promise<void> | void;
}

/**
 * Plugin registration context
 */
export interface PluginRegistrationContext {
  /** Register a node definition */
  registerNode(def: NodeDefinition): void;
  /** Register a trigger definition */
  registerTrigger(def: TriggerDefinition): void;
}

/**
 * Plugin interface
 * @description Standard interface for Record-Replay plugins
 */
export interface RRPlugin {
  /** Plugin name */
  name: string;
  /** Register plugin contents */
  register(ctx: PluginRegistrationContext): void;
}
