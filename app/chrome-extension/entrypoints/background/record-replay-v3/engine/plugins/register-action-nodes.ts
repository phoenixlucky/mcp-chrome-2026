/**
 * @fileoverview Register RR-action replay action handlers as RR-V3 nodes
 * @description
 * Batch registration of action action handlers into the V3 PluginRegistry.
 * This enables V3 to execute flows that use action action types.
 */

import { createReplayActionRegistry } from '@/entrypoints/background/record-replay-v3/actions/handlers';
import type {
  ActionHandler,
  ExecutableActionType,
} from '@/entrypoints/background/record-replay-v3/actions/types';

import type { PluginRegistry } from './registry';
import {
  adaptActionHandlerToNodeDefinition,
  type ActionNodeAdapterOptions,
} from './action-node-adapter';

export interface RegisterActionNodesOptions extends ActionNodeAdapterOptions {
  /**
   * Only include these action types. If not specified, all action handlers are included.
   */
  include?: ReadonlyArray<string>;

  /**
   * Exclude these action types. Applied after include filter.
   */
  exclude?: ReadonlyArray<string>;
}

/**
 * Register action replay action handlers as V3 node definitions.
 *
 * @param registry The V3 PluginRegistry to register nodes into
 * @param options Configuration options
 * @returns Array of registered node kinds
 *
 * @example
 * ```ts
 * const plugins = new PluginRegistry();
 * const registered = registerActionNodes(plugins);
 * console.log('Registered:', registered);
 * ```
 */
export function registerActionNodes(
  registry: PluginRegistry,
  options: RegisterActionNodesOptions = {},
): string[] {
  const actionRegistry = createReplayActionRegistry();
  const handlers = actionRegistry.list();

  const include = options.include ? new Set(options.include) : null;
  const exclude = options.exclude ? new Set(options.exclude) : null;

  const registered: string[] = [];

  for (const handler of handlers) {
    if (include && !include.has(handler.type)) continue;
    if (exclude && exclude.has(handler.type)) continue;

    // Cast needed because action handler types don't perfectly align with V3 NodeKind
    const nodeDef = adaptActionHandlerToNodeDefinition(
      handler as ActionHandler<ExecutableActionType>,
      options,
    );
    registry.registerNode(nodeDef as unknown as Parameters<typeof registry.registerNode>[0]);
    registered.push(handler.type);
  }

  return registered;
}

/**
 * Get list of action action types that can be registered.
 * Useful for debugging and documentation.
 */
export function listActionTypes(): string[] {
  const actionRegistry = createReplayActionRegistry();
  return actionRegistry.list().map((h) => h.type);
}

/**
 * Kept as an explicit extension point for consumers that want to opt out of action kinds.
 */
export const UNSUPPORTED_ACTION_KINDS = [] as const;
