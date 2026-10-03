/**
 * @fileoverview Policy type definitions
 * @description Defines timeout, retry, error handling and artifact policies used in Record-Replay V3
 */

import type { EdgeLabel, NodeId } from './ids';
import type { RRErrorCode } from './errors';
import type { UnixMillis } from './json';

/**
 * Timeout policy
 * @description Defines the timeout duration and scope of an operation
 */
export interface TimeoutPolicy {
  /** Timeout duration (milliseconds) */
  ms: UnixMillis;
  /** Timeout scope: attempt=each attempt, node=whole node execution */
  scope?: 'attempt' | 'node';
}

/**
 * Retry policy
 * @description Defines retry behavior after failure
 */
export interface RetryPolicy {
  /** Max retry count */
  retries: number;
  /** Retry interval (milliseconds) */
  intervalMs: UnixMillis;
  /** Backoff strategy: none=fixed interval, exp=exponential backoff, linear=linear growth */
  backoff?: 'none' | 'exp' | 'linear';
  /** Max retry interval (milliseconds) */
  maxIntervalMs?: UnixMillis;
  /** Jitter strategy: none=no jitter, full=fully random */
  jitter?: 'none' | 'full';
  /** Retry only on these error codes */
  retryOn?: ReadonlyArray<RRErrorCode>;
}

/**
 * Error handling policy
 * @description Defines how execution proceeds after a node fails
 */
export type OnErrorPolicy =
  | { kind: 'stop' }
  | { kind: 'continue'; as?: 'warning' | 'error' }
  | {
      kind: 'goto';
      target: { kind: 'edgeLabel'; label: EdgeLabel } | { kind: 'node'; nodeId: NodeId };
    }
  | { kind: 'retry'; override?: Partial<RetryPolicy> };

/**
 * Artifact policy
 * @description Defines screenshot and log collection behavior
 */
export interface ArtifactPolicy {
  /** Screenshot policy: never=never, onFailure=on failure, always=always */
  screenshot?: 'never' | 'onFailure' | 'always';
  /** Screenshot save path template */
  saveScreenshotAs?: string;
  /** Whether to include console logs */
  includeConsole?: boolean;
  /** Whether to include network requests */
  includeNetwork?: boolean;
}

/**
 * Node-level policy
 * @description Execution policy config for a single node
 */
export interface NodePolicy {
  /** Timeout policy */
  timeout?: TimeoutPolicy;
  /** Retry policy */
  retry?: RetryPolicy;
  /** Error handling policy */
  onError?: OnErrorPolicy;
  /** Artifact policy */
  artifacts?: ArtifactPolicy;
}

/**
 * Flow-level policy
 * @description Execution policy config for the whole Flow
 */
export interface FlowPolicy {
  /** Default node policy */
  defaultNodePolicy?: NodePolicy;
  /** Handling policy for unsupported nodes */
  unsupportedNodePolicy?: OnErrorPolicy;
  /** Total Run timeout (milliseconds) */
  runTimeoutMs?: UnixMillis;
}

/**
 * Merge node policies
 * @description Merges the Flow-level default policy with the node-level policy
 */
export function mergeNodePolicy(
  flowDefault: NodePolicy | undefined,
  nodePolicy: NodePolicy | undefined,
): NodePolicy {
  if (!flowDefault) return nodePolicy ?? {};
  if (!nodePolicy) return flowDefault;

  return {
    timeout: nodePolicy.timeout ?? flowDefault.timeout,
    retry: nodePolicy.retry ?? flowDefault.retry,
    onError: nodePolicy.onError ?? flowDefault.onError,
    artifacts: nodePolicy.artifacts
      ? { ...flowDefault.artifacts, ...nodePolicy.artifacts }
      : flowDefault.artifacts,
  };
}
