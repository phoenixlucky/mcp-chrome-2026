/**
 * @fileoverview Flow type definitions
 * @description Defines the Record-Replay V3 Flow IR (intermediate representation)
 */

import type { ISODateTimeString, JsonObject } from './json';
import type { EdgeId, EdgeLabel, FlowId, NodeId } from './ids';
import type { FlowPolicy, NodePolicy } from './policy';
import type { VariableDefinition } from './variables';

/** Flow Schema version */
export const FLOW_SCHEMA_VERSION = 3 as const;

/**
 * Edge V3
 * @description An edge in the DAG, connecting two nodes
 */
export interface EdgeV3 {
  /** Unique Edge identifier */
  id: EdgeId;
  /** Source node ID */
  from: NodeId;
  /** Target node ID */
  to: NodeId;
  /** Edge label (used for conditional branching and error handling) */
  label?: EdgeLabel;
}

/** Node kind (extensible) */
export type NodeKind = string;

/**
 * Node V3
 * @description A node in the DAG, representing an executable operation
 */
export interface NodeV3 {
  /** Unique Node identifier */
  id: NodeId;
  /** Node kind */
  kind: NodeKind;
  /** Node name (for display) */
  name?: string;
  /** Whether disabled */
  disabled?: boolean;
  /** Node-level policy */
  policy?: NodePolicy;
  /** Node config (type determined by kind) */
  config: JsonObject;
  /** UI layout info */
  ui?: { x: number; y: number };
}

/** Local DAG that can be natively invoked by foreach/while. */
export interface SubflowV3 {
  entryNodeId: NodeId;
  nodes: NodeV3[];
  edges: EdgeV3[];
}

/**
 * Flow metadata binding
 * @description Defines the association between a Flow and a specific domain/path/URL
 */
export interface FlowBinding {
  kind: 'domain' | 'path' | 'url';
  value: string;
}

/**
 * Flow V3
 * @description Complete Flow definition, including nodes, edges and config
 */
export interface FlowV3 {
  /** Schema version */
  schemaVersion: typeof FLOW_SCHEMA_VERSION;
  /** Unique Flow identifier */
  id: FlowId;
  /** Flow name */
  name: string;
  /** Flow description */
  description?: string;
  /** Creation time */
  createdAt: ISODateTimeString;
  /** Update time */
  updatedAt: ISODateTimeString;

  /** Entry node ID (explicitly specified, not inferred from in-degree) */
  entryNodeId: NodeId;
  /** Node list */
  nodes: NodeV3[];
  /** Edge list */
  edges: EdgeV3[];

  /** Named subflows; each subflow is still a cycle-free DAG. */
  subflows?: Record<string, SubflowV3>;

  /** Variable definitions */
  variables?: VariableDefinition[];
  /** Flow-level policy */
  policy?: FlowPolicy;
  /** Metadata */
  meta?: {
    /** Tags */
    tags?: string[];
    /** Binding rules */
    bindings?: FlowBinding[];
  };
}

/**
 * Find a node by ID
 */
export function findNodeById(flow: FlowV3, nodeId: NodeId): NodeV3 | undefined {
  return flow.nodes.find((n) => n.id === nodeId);
}

/**
 * Find all edges starting from the given node
 */
export function findEdgesFrom(flow: FlowV3, nodeId: NodeId): EdgeV3[] {
  return flow.edges.filter((e) => e.from === nodeId);
}

/**
 * Find all edges pointing to the given node
 */
export function findEdgesTo(flow: FlowV3, nodeId: NodeId): EdgeV3[] {
  return flow.edges.filter((e) => e.to === nodeId);
}
