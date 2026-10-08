/**
 * Action System - export module
 */

// Type exports
export * from './types';

// Registry exports
export {
  ActionRegistry,
  createActionRegistry,
  ok,
  invalid,
  failed,
  tryResolveString,
  tryResolveNumber,
  tryResolveJson,
  tryResolveValue,
  type BeforeExecuteArgs,
  type BeforeExecuteHook,
  type AfterExecuteArgs,
  type AfterExecuteHook,
  type ActionRegistryHooks,
} from './registry';

// Handler factory exports
export {
  createReplayActionRegistry,
  registerReplayHandlers,
  getSupportedActionTypes,
  isActionTypeSupported,
} from './handlers';
