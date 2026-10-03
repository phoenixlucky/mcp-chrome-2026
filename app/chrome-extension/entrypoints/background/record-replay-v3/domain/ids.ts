/**
 * @fileoverview ID type definitions
 * @description Defines the various ID types used in Record-Replay V3
 */

/** Unique Flow identifier */
export type FlowId = string;

/** Unique Node identifier */
export type NodeId = string;

/** Unique Edge identifier */
export type EdgeId = string;

/** Unique Run identifier */
export type RunId = string;

/** Unique Trigger identifier */
export type TriggerId = string;

/** Edge label type */
export type EdgeLabel = string;

/** Predefined Edge label constants */
export const EDGE_LABELS = {
  /** Default edge */
  DEFAULT: 'default',
  /** Error handling edge */
  ON_ERROR: 'onError',
  /** Edge taken when the condition is true */
  TRUE: 'true',
  /** Edge taken when the condition is false */
  FALSE: 'false',
} as const;

/** Edge label type (derived from the constants) */
export type EdgeLabelValue = (typeof EDGE_LABELS)[keyof typeof EDGE_LABELS];
