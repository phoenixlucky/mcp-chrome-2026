import { bootstrapV3, getV3Runtime } from './bootstrap';
import { enqueueRun } from './engine/queue/enqueue-run';
import type { FlowId } from './domain/ids';
import type { JsonObject } from './domain/json';

async function runtime() {
  return getV3Runtime() ?? bootstrapV3();
}

export async function getFlow(flowId: string) {
  return (await runtime()).storage.flows.get(flowId as FlowId);
}

export async function listFlows() {
  return (await runtime()).storage.flows.list();
}

export async function enqueueFlow(flowId: string, args?: JsonObject) {
  const current = await runtime();
  return enqueueRun(
    { storage: current.storage, events: current.events, scheduler: current.scheduler },
    { flowId: flowId as FlowId, ...(args ? { args } : {}) },
  );
}
