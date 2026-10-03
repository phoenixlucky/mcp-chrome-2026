/**
 * @fileoverview Port RPC protocol definition
 * @description Defines the protocol types for communication over chrome.runtime.Port
 */

import type { JsonObject, JsonValue } from '../../domain/json';
import type { RunId } from '../../domain/ids';
import type { RunEvent } from '../../domain/events';

/** Port name */
export const RR_V3_PORT_NAME = 'rr_v3' as const;

/**
 * RPC method names
 */
export type RpcMethod =
  // Query methods
  | 'rr_v3.listRuns'
  | 'rr_v3.getRun'
  | 'rr_v3.getEvents'
  // Flow management methods
  | 'rr_v3.getFlow'
  | 'rr_v3.listFlows'
  | 'rr_v3.saveFlow'
  | 'rr_v3.deleteFlow'
  // Trigger management methods
  | 'rr_v3.createTrigger'
  | 'rr_v3.updateTrigger'
  | 'rr_v3.deleteTrigger'
  | 'rr_v3.getTrigger'
  | 'rr_v3.listTriggers'
  | 'rr_v3.enableTrigger'
  | 'rr_v3.disableTrigger'
  | 'rr_v3.fireTrigger'
  // Queue management methods
  | 'rr_v3.enqueueRun'
  | 'rr_v3.listQueue'
  | 'rr_v3.cancelQueueItem'
  // Control methods
  | 'rr_v3.startRun'
  | 'rr_v3.cancelRun'
  | 'rr_v3.pauseRun'
  | 'rr_v3.resumeRun'
  // Debug methods
  | 'rr_v3.debug'
  // Subscription methods
  | 'rr_v3.subscribe'
  | 'rr_v3.unsubscribe';

/**
 * RPC request message
 */
export interface RpcRequest {
  type: 'rr_v3.request';
  /** Request ID (used to match the response) */
  requestId: string;
  /** Method name */
  method: RpcMethod;
  /** Params */
  params?: JsonObject;
}

/**
 * RPC success response
 */
export interface RpcResponseOk {
  type: 'rr_v3.response';
  /** Corresponding request ID */
  requestId: string;
  ok: true;
  /** Returned result */
  result: JsonValue;
}

/**
 * RPC error response
 */
export interface RpcResponseErr {
  type: 'rr_v3.response';
  /** Corresponding request ID */
  requestId: string;
  ok: false;
  /** Error message */
  error: string;
}

/**
 * RPC response
 */
export type RpcResponse = RpcResponseOk | RpcResponseErr;

/**
 * RPC event push
 */
export interface RpcEventMessage {
  type: 'rr_v3.event';
  /** Event data */
  event: RunEvent;
}

/**
 * RPC subscription ack
 */
export interface RpcSubscribeAck {
  type: 'rr_v3.subscribeAck';
  /** Subscribed Run ID (optional, null means subscribe to all) */
  runId: RunId | null;
}

/**
 * All RPC message types
 */
export type RpcMessage =
  RpcRequest | RpcResponseOk | RpcResponseErr | RpcEventMessage | RpcSubscribeAck;

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Determine whether a message is an RPC request
 */
export function isRpcRequest(msg: unknown): msg is RpcRequest {
  return typeof msg === 'object' && msg !== null && (msg as RpcRequest).type === 'rr_v3.request';
}

/**
 * Determine whether a message is an RPC response
 */
export function isRpcResponse(msg: unknown): msg is RpcResponse {
  return typeof msg === 'object' && msg !== null && (msg as RpcResponse).type === 'rr_v3.response';
}

/**
 * Determine whether a message is an RPC event
 */
export function isRpcEvent(msg: unknown): msg is RpcEventMessage {
  return typeof msg === 'object' && msg !== null && (msg as RpcEventMessage).type === 'rr_v3.event';
}

/**
 * Create an RPC request
 */
export function createRpcRequest(method: RpcMethod, params?: JsonObject): RpcRequest {
  return {
    type: 'rr_v3.request',
    requestId: generateRequestId(),
    method,
    params,
  };
}

/**
 * Create a success response
 */
export function createRpcResponseOk(requestId: string, result: JsonValue): RpcResponseOk {
  return {
    type: 'rr_v3.response',
    requestId,
    ok: true,
    result,
  };
}

/**
 * Create an error response
 */
export function createRpcResponseErr(requestId: string, error: string): RpcResponseErr {
  return {
    type: 'rr_v3.response',
    requestId,
    ok: false,
    error,
  };
}

/**
 * Create an event message
 */
export function createRpcEventMessage(event: RunEvent): RpcEventMessage {
  return {
    type: 'rr_v3.event',
    event,
  };
}
