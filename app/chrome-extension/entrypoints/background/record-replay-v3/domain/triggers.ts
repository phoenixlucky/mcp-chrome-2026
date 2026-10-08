/**
 * @fileoverview Trigger type definitions
 * @description Defines trigger specs used in Record-Replay V3
 */

import type { JsonObject, UnixMillis } from './json';
import type { FlowId, TriggerId } from './ids';

/** Trigger kind */
export type TriggerKind =
  'manual' | 'url' | 'cron' | 'interval' | 'once' | 'command' | 'contextMenu' | 'dom';

/**
 * Trigger base interface
 */
export interface TriggerSpecBase {
  /** Trigger ID */
  id: TriggerId;
  /** Trigger kind */
  kind: TriggerKind;
  /** Whether enabled */
  enabled: boolean;
  /** Associated Flow ID */
  flowId: FlowId;
  /** Args passed to the Flow */
  args?: JsonObject;
}

/**
 * URL match rule
 */
export interface UrlMatchRule {
  kind: 'url' | 'domain' | 'path';
  value: string;
}

/**
 * Trigger spec union type
 */
export type TriggerSpec =
  // Manual trigger
  | (TriggerSpecBase & { kind: 'manual' })

  // URL trigger
  | (TriggerSpecBase & {
      kind: 'url';
      match: UrlMatchRule[];
    })

  // Cron timer trigger
  | (TriggerSpecBase & {
      kind: 'cron';
      cron: string;
      timezone?: string;
    })

  // Interval timer trigger (repeats at a fixed interval)
  | (TriggerSpecBase & {
      kind: 'interval';
      /** Interval in minutes, minimum 1 */
      periodMinutes: number;
    })

  // Once timer trigger (fires once at the given time, then auto-disables)
  | (TriggerSpecBase & {
      kind: 'once';
      /** Fire timestamp (Unix milliseconds) */
      whenMs: UnixMillis;
    })

  // Keyboard shortcut trigger
  | (TriggerSpecBase & {
      kind: 'command';
      commandKey: string;
    })

  // Context menu trigger
  | (TriggerSpecBase & {
      kind: 'contextMenu';
      title: string;
      contexts?: ReadonlyArray<string>;
    })

  // DOM element appearance trigger
  | (TriggerSpecBase & {
      kind: 'dom';
      selector: string;
      appear?: boolean;
      once?: boolean;
      debounceMs?: UnixMillis;
    });

/**
 * Trigger fire context
 * @description Describes context information when a trigger fires
 */
export interface TriggerFireContext {
  /** Trigger ID */
  triggerId: TriggerId;
  /** Trigger kind */
  kind: TriggerKind;
  /** Fire time */
  firedAt: UnixMillis;
  /** Source Tab ID */
  sourceTabId?: number;
  /** Source URL */
  sourceUrl?: string;
}

/**
 * Get the typed trigger spec for a trigger kind
 */
export type TriggerSpecByKind<K extends TriggerKind> = Extract<TriggerSpec, { kind: K }>;

/**
 * Determine whether a trigger is enabled
 */
export function isTriggerEnabled(trigger: TriggerSpec): boolean {
  return trigger.enabled;
}

/**
 * Create a trigger fire context
 */
export function createTriggerFireContext(
  trigger: TriggerSpec,
  options?: { sourceTabId?: number; sourceUrl?: string },
): TriggerFireContext {
  return {
    triggerId: trigger.id,
    kind: trigger.kind,
    firedAt: Date.now(),
    sourceTabId: options?.sourceTabId,
    sourceUrl: options?.sourceUrl,
  };
}
