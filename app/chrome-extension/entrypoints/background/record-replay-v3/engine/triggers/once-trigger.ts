/**
 * @fileoverview Once Trigger Handler (M3.1)
 * @description
 * Implements one-shot timer triggers using the chrome.alarms `when` parameter.
 *
 * Behavior:
 * - Each trigger maps to a one-shot alarm
 * - After firing, the trigger is auto-disabled (enabled=false) and uninstalled
 */

import type { UnixMillis } from '../../domain/json';
import type { TriggerId } from '../../domain/ids';
import type { TriggerSpecByKind } from '../../domain/triggers';
import { createTriggersStore } from '../../storage/triggers';
import type { TriggerFireCallback, TriggerHandler, TriggerHandlerFactory } from './trigger-handler';

// ==================== Types ====================

type OnceTriggerSpec = TriggerSpecByKind<'once'>;

export interface OnceTriggerHandlerDeps {
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  /**
   * Optional: custom trigger disable method
   * If not provided, updates TriggerStore directly
   */
  disableTrigger?: (triggerId: TriggerId) => Promise<void>;
}

interface InstalledOnceTrigger {
  spec: OnceTriggerSpec;
  whenMs: UnixMillis;
  version: number;
}

// ==================== Constants ====================

const ALARM_PREFIX = 'rr_v3_once_';

// ==================== Utilities ====================

/**
 * Validate and normalize whenMs
 */
function normalizeWhenMs(value: unknown): UnixMillis {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('whenMs must be a finite number');
  }
  return Math.floor(value) as UnixMillis;
}

/**
 * Generate the alarm name
 */
function alarmNameForTrigger(triggerId: TriggerId): string {
  return `${ALARM_PREFIX}${triggerId}`;
}

/**
 * Parse the triggerId from an alarm name
 */
function parseTriggerIdFromAlarmName(name: string): TriggerId | null {
  if (!name.startsWith(ALARM_PREFIX)) return null;
  const id = name.slice(ALARM_PREFIX.length);
  return id ? (id as TriggerId) : null;
}

// ==================== Handler Implementation ====================

/**
 * Create the once trigger handler factory
 */
export function createOnceTriggerHandlerFactory(
  deps?: OnceTriggerHandlerDeps,
): TriggerHandlerFactory<'once'> {
  return (fireCallback) => createOnceTriggerHandler(fireCallback, deps);
}

/**
 * Create the once trigger handler
 */
export function createOnceTriggerHandler(
  fireCallback: TriggerFireCallback,
  deps?: OnceTriggerHandlerDeps,
): TriggerHandler<'once'> {
  const logger = deps?.logger ?? console;

  // Create the store lazily to avoid issues in test environments
  let triggersStore: ReturnType<typeof createTriggersStore> | null = null;
  const getTriggersStore = () => {
    if (!triggersStore) {
      triggersStore = createTriggersStore();
    }
    return triggersStore;
  };

  const disableTrigger =
    deps?.disableTrigger ??
    (async (triggerId: TriggerId) => {
      const store = getTriggersStore();
      const existing = await store.get(triggerId);
      if (!existing) return;
      if (!existing.enabled) return;
      await store.save({ ...existing, enabled: false });
    });

  const installed = new Map<TriggerId, InstalledOnceTrigger>();
  const versions = new Map<TriggerId, number>();
  let listening = false;

  /**
   * Bump the version to invalidate pending operations
   */
  function bumpVersion(triggerId: TriggerId): number {
    const next = (versions.get(triggerId) ?? 0) + 1;
    versions.set(triggerId, next);
    return next;
  }

  /**
   * Clear the given alarm
   */
  async function clearAlarmByName(name: string): Promise<void> {
    if (!chrome.alarms?.clear) return;
    try {
      await Promise.resolve(chrome.alarms.clear(name));
    } catch (e) {
      logger.debug('[OnceTriggerHandler] alarms.clear failed:', e);
    }
  }

  /**
   * Clear all once alarms
   */
  async function clearAllOnceAlarms(): Promise<void> {
    if (!chrome.alarms?.getAll || !chrome.alarms?.clear) return;
    try {
      const alarms = await Promise.resolve(chrome.alarms.getAll());
      const list = Array.isArray(alarms) ? alarms : [];
      await Promise.all(
        list.filter((a) => a?.name?.startsWith(ALARM_PREFIX)).map((a) => clearAlarmByName(a.name)),
      );
    } catch (e) {
      logger.debug('[OnceTriggerHandler] alarms.getAll failed:', e);
    }
  }

  /**
   * Schedule the alarm
   */
  async function schedule(triggerId: TriggerId, expectedVersion: number): Promise<void> {
    if (!chrome.alarms?.create) {
      logger.warn('[OnceTriggerHandler] chrome.alarms.create is unavailable');
      return;
    }

    const entry = installed.get(triggerId);
    if (!entry || entry.version !== expectedVersion) return;

    const name = alarmNameForTrigger(triggerId);

    try {
      await Promise.resolve(chrome.alarms.create(name, { when: entry.whenMs }));
    } catch (e) {
      logger.error(`[OnceTriggerHandler] alarms.create failed for trigger "${triggerId}":`, e);
    }
  }

  /**
   * Internal uninstall logic (does not trigger the public uninstall)
   */
  async function uninstallInternal(triggerId: TriggerId): Promise<void> {
    bumpVersion(triggerId);
    installed.delete(triggerId);
    await clearAlarmByName(alarmNameForTrigger(triggerId));

    if (installed.size === 0) {
      stopListening();
    }
  }

  /**
   * Alarm event handler
   */
  const onAlarm = (alarm: chrome.alarms.Alarm): void => {
    const triggerId = parseTriggerIdFromAlarmName(alarm?.name ?? '');
    if (!triggerId) return;

    const entry = installed.get(triggerId);
    if (!entry) return;

    const expectedVersion = entry.version;

    void (async () => {
      try {
        await fireCallback.onFire(triggerId, {
          sourceTabId: undefined,
          sourceUrl: undefined,
        });
      } catch (e) {
        logger.error(`[OnceTriggerHandler] onFire failed for trigger "${triggerId}":`, e);
      } finally {
        // Check that the version is still valid
        if (installed.get(triggerId)?.version === expectedVersion) {
          // Disable the trigger
          try {
            await disableTrigger(triggerId);
          } catch (e) {
            logger.error(
              `[OnceTriggerHandler] Failed to disable trigger "${triggerId}" after fire:`,
              e,
            );
          }

          // Uninstall the trigger
          try {
            await uninstallInternal(triggerId);
          } catch (e) {
            logger.error(
              `[OnceTriggerHandler] Failed to uninstall trigger "${triggerId}" after fire:`,
              e,
            );
          }
        }
      }
    })();
  };

  /**
   * Ensure alarm events are being listened to
   */
  function ensureListening(): void {
    if (listening) return;
    if (!chrome.alarms?.onAlarm?.addListener) {
      logger.warn('[OnceTriggerHandler] chrome.alarms.onAlarm is unavailable');
      return;
    }
    chrome.alarms.onAlarm.addListener(onAlarm);
    listening = true;
  }

  /**
   * Stop listening to alarm events
   */
  function stopListening(): void {
    if (!listening) return;
    try {
      chrome.alarms.onAlarm.removeListener(onAlarm);
    } catch (e) {
      logger.debug('[OnceTriggerHandler] removeListener failed:', e);
    } finally {
      listening = false;
    }
  }

  return {
    kind: 'once',

    async install(trigger: OnceTriggerSpec): Promise<void> {
      const whenMs = normalizeWhenMs(trigger.whenMs);

      const version = bumpVersion(trigger.id);
      installed.set(trigger.id, {
        spec: { ...trigger, whenMs },
        whenMs,
        version,
      });

      ensureListening();
      await schedule(trigger.id, version);
    },

    async uninstall(triggerId: string): Promise<void> {
      await uninstallInternal(triggerId as TriggerId);
    },

    async uninstallAll(): Promise<void> {
      for (const id of installed.keys()) {
        bumpVersion(id);
      }
      installed.clear();
      await clearAllOnceAlarms();
      stopListening();
    },

    getInstalledIds(): string[] {
      return Array.from(installed.keys());
    },
  };
}
