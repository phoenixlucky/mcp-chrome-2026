/**
 * @fileoverview Lease management
 * @description Manages Run lease renewal and expiry reclamation
 */

import type { UnixMillis } from '../../domain/json';
import type { RunId } from '../../domain/ids';
import type { RunQueue, RunQueueConfig, Lease } from './queue';

/**
 * Lease manager
 * @description Manages lease renewal and expiry detection
 */
export interface LeaseManager {
  /**
   * Start the heartbeat
   * @param ownerId Owner ID
   */
  startHeartbeat(ownerId: string): void;

  /**
   * Stop the heartbeat
   * @param ownerId Owner ID
   */
  stopHeartbeat(ownerId: string): void;

  /**
   * Check for and reclaim expired leases
   * @param now Current time
   * @returns List of reclaimed Run IDs
   */
  reclaimExpiredLeases(now: UnixMillis): Promise<RunId[]>;

  /**
   * Determine whether a lease has expired
   */
  isLeaseExpired(lease: Lease, now: UnixMillis): boolean;

  /**
   * Create a new lease
   */
  createLease(ownerId: string, now: UnixMillis): Lease;

  /**
   * Stop all heartbeats
   */
  dispose(): void;
}

/**
 * Create the lease manager
 */
export function createLeaseManager(queue: RunQueue, config: RunQueueConfig): LeaseManager {
  const heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();

  return {
    startHeartbeat(ownerId: string): void {
      // Stop an existing timer first
      this.stopHeartbeat(ownerId);

      // Create a new heartbeat timer
      const timer = setInterval(async () => {
        try {
          await queue.heartbeat(ownerId, Date.now());
        } catch (error) {
          console.error(`[LeaseManager] Heartbeat failed for ${ownerId}:`, error);
        }
      }, config.heartbeatIntervalMs);

      heartbeatTimers.set(ownerId, timer);
    },

    stopHeartbeat(ownerId: string): void {
      const timer = heartbeatTimers.get(ownerId);
      if (timer) {
        clearInterval(timer);
        heartbeatTimers.delete(ownerId);
      }
    },

    async reclaimExpiredLeases(now: UnixMillis): Promise<RunId[]> {
      // Delegate to the queue implementation which uses the lease_expiresAt index
      // for efficient scanning and updates storage atomically.
      return queue.reclaimExpiredLeases(now);
    },

    isLeaseExpired(lease: Lease, now: UnixMillis): boolean {
      return lease.expiresAt < now;
    },

    createLease(ownerId: string, now: UnixMillis): Lease {
      return {
        ownerId,
        expiresAt: now + config.leaseTtlMs,
      };
    },

    dispose(): void {
      for (const timer of heartbeatTimers.values()) {
        clearInterval(timer);
      }
      heartbeatTimers.clear();
    },
  };
}

/**
 * Generate a unique owner ID
 * @description Used to identify the current Service Worker instance
 */
export function generateOwnerId(): string {
  return `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
