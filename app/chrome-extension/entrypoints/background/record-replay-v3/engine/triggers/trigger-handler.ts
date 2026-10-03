/**
 * @fileoverview Trigger handler interface definitions
 * @description Defines the unified interface for all trigger handlers
 */

import type { TriggerSpec, TriggerKind } from '../../domain/triggers';

/**
 * Trigger handler interface
 * @description Each trigger kind must implement this interface
 */
export interface TriggerHandler<K extends TriggerKind = TriggerKind> {
  /** Trigger kind */
  readonly kind: K;

  /**
   * Install the trigger
   * @description Registers chrome API listeners etc.
   * @param trigger Trigger spec
   */
  install(trigger: Extract<TriggerSpec, { kind: K }>): Promise<void>;

  /**
   * Uninstall the trigger
   * @description Removes chrome API listeners etc.
   * @param triggerId Trigger ID
   */
  uninstall(triggerId: string): Promise<void>;

  /**
   * Uninstall all triggers
   * @description Cleans up all triggers of this kind
   */
  uninstallAll(): Promise<void>;

  /**
   * Get the list of installed trigger IDs
   */
  getInstalledIds(): string[];
}

/**
 * Trigger fire callback
 * @description Callback injected into each Handler by TriggerManager
 */
export interface TriggerFireCallback {
  /**
   * Called when a trigger fires
   * @param triggerId Trigger ID
   * @param context Fire context
   */
  onFire(
    triggerId: string,
    context: {
      sourceTabId?: number;
      sourceUrl?: string;
    },
  ): Promise<void>;
}

/**
 * Trigger handler factory
 */
export type TriggerHandlerFactory<K extends TriggerKind> = (
  fireCallback: TriggerFireCallback,
) => TriggerHandler<K>;
