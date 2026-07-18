import type { Flow as BuilderFlow, NodeBase as BuilderNode } from '@/entrypoints/background/record-replay-v3/builder-types';
import { FLOW_SCHEMA_VERSION, type FlowV3, type SubflowV3 } from '@/entrypoints/background/record-replay-v3/domain/flow';
import type { FlowId, NodeId } from '@/entrypoints/background/record-replay-v3/domain/ids';
import type { JsonObject } from '@/entrypoints/background/record-replay-v3/domain/json';

export interface FlowConversionResult<T> {
  flow: T;
  warnings: string[];
}

const UNSUPPORTED_NODE_KINDS = new Set(['loopElements', 'executeFlow']);

function entryNodeId(nodes: BuilderNode[], edges: BuilderFlow['edges']): NodeId {
  const executable = nodes.filter((node) => node.type !== 'trigger');
  if (!executable.length) throw new Error('工作流至少需要一个可执行节点');
  const targets = new Set((edges || []).map((edge) => edge.to));
  return (executable.find((node) => !targets.has(node.id)) || executable[0]).id as NodeId;
}

export function builderFlowToV3(flow: BuilderFlow): FlowConversionResult<FlowV3> {
  const nodes = flow.nodes || [];
  const unsupported = nodes.filter((node) => UNSUPPORTED_NODE_KINDS.has(node.type));
  if (unsupported.length) throw new Error(`V3 不支持节点：${unsupported.map((node) => node.type).join(', ')}`);
  const now = new Date().toISOString();
  return {
    flow: {
      schemaVersion: FLOW_SCHEMA_VERSION,
      id: flow.id as FlowId,
      name: flow.name,
      ...(flow.description ? { description: flow.description } : {}),
      createdAt: flow.meta?.createdAt || now,
      updatedAt: now,
      entryNodeId: entryNodeId(nodes, flow.edges),
      nodes: nodes.map((node) => ({
        id: node.id as NodeId,
        kind: node.type,
        ...(node.name ? { name: node.name } : {}),
        ...(node.disabled ? { disabled: true } : {}),
        config: (node.config || {}) as JsonObject,
        ...(node.ui ? { ui: node.ui } : {}),
      })),
      edges: (flow.edges || []).map((edge) => ({
        id: edge.id,
        from: edge.from as NodeId,
        to: edge.to as NodeId,
        ...(edge.label ? { label: edge.label } : {}),
      })),
      ...(Object.keys(flow.subflows || {}).length
        ? { subflows: Object.fromEntries(Object.entries(flow.subflows || {}).map(([id, subflow]) => {
            const subNodes = subflow.nodes || [];
            return [id, {
              entryNodeId: entryNodeId(subNodes, subflow.edges || []),
              nodes: subNodes.map((node) => ({ id: node.id as NodeId, kind: node.type, ...(node.name ? { name: node.name } : {}), ...(node.disabled ? { disabled: true } : {}), config: (node.config || {}) as JsonObject, ...(node.ui ? { ui: node.ui } : {}) })),
              edges: (subflow.edges || []).map((edge) => ({ id: edge.id, from: edge.from as NodeId, to: edge.to as NodeId, ...(edge.label ? { label: edge.label } : {}) })),
            } satisfies SubflowV3];
          })) }
        : {}),
      ...(flow.variables?.length
        ? { variables: flow.variables.map((variable) => ({ name: variable.key, label: variable.label, sensitive: variable.sensitive, required: variable.rules?.required, ...(variable.default !== undefined ? { default: variable.default } : {}) })) }
        : {}),
      ...(flow.meta?.tags || flow.meta?.bindings
        ? { meta: { ...(flow.meta.tags ? { tags: flow.meta.tags } : {}), ...(flow.meta.bindings ? { bindings: flow.meta.bindings.map((binding) => ({ kind: binding.type, value: binding.value })) } : {}) } }
        : {}),
    },
    warnings: [],
  };
}

export function flowV3ToBuilder(flow: FlowV3): FlowConversionResult<BuilderFlow> {
  return {
    flow: {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      version: FLOW_SCHEMA_VERSION,
      meta: {
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
        ...(flow.meta?.tags ? { tags: flow.meta.tags } : {}),
        ...(flow.meta?.bindings ? { bindings: flow.meta.bindings.map((binding) => ({ type: binding.kind, value: binding.value })) } : {}),
      },
      variables: flow.variables?.map((variable) => ({ key: variable.name, label: variable.label, sensitive: variable.sensitive, ...(variable.default !== undefined ? { default: variable.default } : {}), ...(variable.required ? { rules: { required: true } } : {}) })),
      nodes: flow.nodes.map((node) => ({ id: node.id, type: node.kind as BuilderNode['type'], name: node.name, disabled: node.disabled, config: node.config, ui: node.ui })),
      edges: flow.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, label: edge.label })),
      ...(flow.subflows ? { subflows: Object.fromEntries(Object.entries(flow.subflows).map(([id, subflow]) => [id, {
        nodes: subflow.nodes.map((node) => ({ id: node.id, type: node.kind as BuilderNode['type'], name: node.name, disabled: node.disabled, config: node.config, ui: node.ui })),
        edges: subflow.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, label: edge.label })),
      }])) } : {}),
    },
    warnings: [],
  };
}

export function isFlowV3(value: unknown): value is FlowV3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const flow = value as Record<string, unknown>;
  return flow.schemaVersion === FLOW_SCHEMA_VERSION && typeof flow.id === 'string' && typeof flow.name === 'string' && typeof flow.entryNodeId === 'string' && Array.isArray(flow.nodes) && Array.isArray(flow.edges);
}

export function extractFlowCandidates(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed.filter(isFlowV3);
  if (isFlowV3(parsed)) return [parsed];
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { flows?: unknown[] }).flows)) return (parsed as { flows: unknown[] }).flows.filter(isFlowV3);
  return [];
}
