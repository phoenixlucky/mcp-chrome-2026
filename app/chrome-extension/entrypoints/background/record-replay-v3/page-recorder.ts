import { mapStepToNodeConfig } from '@ethanwilkins/chrome-mcp-shared-2026';
import { BACKGROUND_MESSAGE_TYPES, TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { bootstrapV3 } from './bootstrap';
import { FLOW_SCHEMA_VERSION, type FlowV3 } from './domain/flow';
import type { FlowId, NodeId } from './domain/ids';
import type { JsonObject } from './domain/json';

type Status = 'idle' | 'recording' | 'paused' | 'stopping';
type RecordedStep = { id?: string; type?: string; [key: string]: unknown };
type RecordedVariable = { key?: string; sensitive?: boolean; default?: unknown };

let status: Status = 'idle';
let tabId: number | null = null;
let flow: FlowV3 | null = null;

const recorderScript = 'inject-scripts/recorder.js';
const RECORDING_COMMANDS = {
  start: 'start_page_recording',
  pause: 'toggle_page_recording_pause',
  stop: 'stop_page_recording',
} as const;

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function json(value: unknown): JsonObject {
  // Recorder messages cross a trust boundary; retain only serializable action data.
  return JSON.parse(JSON.stringify(value && typeof value === 'object' ? value : {})) as JsonObject;
}

async function control(command: 'start' | 'pause' | 'resume' | 'stop', meta?: unknown) {
  if (tabId === null) return;
  if (command === 'start') {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: [recorderScript],
      world: 'ISOLATED',
    });
  }
  const frames = (await chrome.webNavigation.getAllFrames({ tabId }).catch(() => [])) || [];
  await Promise.all(
    (frames.length ? frames : [{ frameId: 0 }]).map((frame) =>
      chrome.tabs
        .sendMessage(
          tabId!,
          { action: TOOL_MESSAGE_TYPES.RR_RECORDER_CONTROL, cmd: command, meta },
          { frameId: frame.frameId },
        )
        .catch(() => undefined),
    ),
  );
}

function appendSteps(steps: unknown[]) {
  if (!flow || !Array.isArray(steps)) return;
  for (const raw of steps) {
    if (!raw || typeof raw !== 'object') continue;
    const step = raw as RecordedStep;
    const kind = typeof step.type === 'string' ? step.type : '';
    if (!kind) continue;
    const nodeId = typeof step.id === 'string' && step.id ? step.id : id('step');
    const config = json(mapStepToNodeConfig({ ...step, id: nodeId }));
    const existing = flow.nodes.find((node) => node.id === nodeId);
    if (existing) {
      existing.kind = kind;
      existing.config = config;
      continue;
    }
    const previous = flow.nodes.at(-1);
    flow.nodes.push({
      id: nodeId as NodeId,
      kind,
      config,
      ui: { x: flow.nodes.length * 220, y: 120 },
    });
    if (previous) {
      flow.edges.push({ id: id('edge') as any, from: previous.id, to: nodeId as NodeId });
    }
  }
  flow.updatedAt = new Date().toISOString();
}

function appendVariables(variables: unknown[]) {
  if (!flow || !Array.isArray(variables)) return;
  const current = flow.variables || (flow.variables = []);
  for (const raw of variables) {
    const variable = raw as RecordedVariable;
    if (!variable?.key || current.some((item) => item.name === variable.key)) continue;
    current.push({
      name: variable.key,
      sensitive: !!variable.sensitive,
      ...(typeof variable.default === 'string' ? { default: variable.default } : {}),
    });
  }
}

async function start(): Promise<{ success: boolean; flowId?: string; error?: string }> {
  if (status !== 'idle') return { success: false, error: '已有进行中的录制' };
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active?.id || !active.url || !/^https?:/i.test(active.url)) {
    return { success: false, error: '请切换到 http/https 普通网页后再开始录制' };
  }
  const now = new Date().toISOString();
  const page = new URL(active.url);
  const flowId = id('flow') as FlowId;
  const entryId = id('step') as NodeId;
  flow = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    id: flowId,
    name: `页面录制 ${new Date().toLocaleString()}`,
    description: `录制自 ${active.url}`,
    createdAt: now,
    updatedAt: now,
    entryNodeId: entryId,
    nodes: [{ id: entryId, kind: 'navigate', config: { url: active.url }, ui: { x: 0, y: 120 } }],
    edges: [],
    meta: { tags: ['页面录制'], bindings: [{ kind: 'domain', value: page.hostname }] },
  };
  tabId = active.id;
  status = 'recording';
  try {
    await control('start', { id: flowId, name: flow.name, description: flow.description });
    return { success: true, flowId };
  } catch (error) {
    status = 'idle';
    tabId = null;
    flow = null;
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function stop(): Promise<{ success: boolean; flow?: FlowV3; error?: string }> {
  if (!flow || status === 'idle') return { success: false, error: '当前没有录制' };
  status = 'stopping';
  await control('stop').catch(() => undefined);
  const saved = flow;
  status = 'idle';
  tabId = null;
  flow = null;
  await (await bootstrapV3()).storage.flows.save(saved);
  chrome.runtime
    .sendMessage({ type: BACKGROUND_MESSAGE_TYPES.RR_FLOWS_CHANGED })
    .catch(() => undefined);
  return { success: true, flow: saved };
}

async function pause(): Promise<{ success: boolean; error?: string }> {
  if (status !== 'recording') return { success: false, error: '当前未在录制' };
  status = 'paused';
  await control('pause');
  return { success: true };
}

async function resume(): Promise<{ success: boolean; error?: string }> {
  if (status !== 'paused') return { success: false, error: '当前未暂停' };
  status = 'recording';
  await control('resume');
  return { success: true };
}

async function handleRecordingCommand(command: string): Promise<void> {
  if (command === RECORDING_COMMANDS.start) await start();
  else if (command === RECORDING_COMMANDS.pause) await (status === 'paused' ? resume() : pause());
  else if (command === RECORDING_COMMANDS.stop) await stop();
}

export function initPageRecorder(): void {
  chrome.commands.onCommand.addListener((command) => {
    handleRecordingCommand(command).catch(() => undefined);
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === TOOL_MESSAGE_TYPES.RR_RECORDER_EVENT) {
      if (status === 'recording' || status === 'stopping') {
        const payload = message.payload || {};
        if (payload.kind === 'steps') appendSteps(payload.steps || []);
        if (payload.kind === 'variables') appendVariables(payload.variables || []);
      }
      sendResponse({ ok: true });
      return true;
    }
    const reply = async () => {
      switch (message?.type) {
        case BACKGROUND_MESSAGE_TYPES.RR_START_RECORDING:
          return start();
        case BACKGROUND_MESSAGE_TYPES.RR_STOP_RECORDING:
          return stop();
        case BACKGROUND_MESSAGE_TYPES.RR_PAUSE_RECORDING:
          return pause();
        case BACKGROUND_MESSAGE_TYPES.RR_RESUME_RECORDING:
          return resume();
        case BACKGROUND_MESSAGE_TYPES.RR_GET_RECORDING_STATUS:
          return { success: true, status, flowId: flow?.id };
        case BACKGROUND_MESSAGE_TYPES.RR_LIST_FLOWS:
          return { success: true, flows: await (await bootstrapV3()).storage.flows.list() };
        case BACKGROUND_MESSAGE_TYPES.RR_GET_FLOW:
          return {
            success: true,
            flow: await (await bootstrapV3()).storage.flows.get(message.flowId),
          };
        default:
          return undefined;
      }
    };
    reply()
      .then((result) => result !== undefined && sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  });
}
