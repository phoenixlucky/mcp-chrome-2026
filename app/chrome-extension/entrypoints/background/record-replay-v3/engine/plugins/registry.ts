/**
 * @fileoverview Plugin registry
 * @description Manages registration and lookup of node and trigger plugins
 */

import type { NodeKind } from '../../domain/flow';
import type { TriggerKind } from '../../domain/triggers';
import { RR_ERROR_CODES, createRRError } from '../../domain/errors';
import type {
  NodeDefinition,
  TriggerDefinition,
  PluginRegistrationContext,
  RRPlugin,
} from './types';

/**
 * Plugin registry
 * @description Singleton managing all registered nodes and triggers
 */
export class PluginRegistry implements PluginRegistrationContext {
  private nodes = new Map<NodeKind, NodeDefinition>();
  private triggers = new Map<TriggerKind, TriggerDefinition>();

  /**
   * Register a node definition
   * @description Overwrites if a node with the same kind already exists
   */
  registerNode(def: NodeDefinition): void {
    this.nodes.set(def.kind, def);
  }

  /**
   * Register a trigger definition
   * @description Overwrites if a trigger with the same kind already exists
   */
  registerTrigger(def: TriggerDefinition): void {
    this.triggers.set(def.kind, def);
  }

  /**
   * Get a node definition
   * @returns Node definition or undefined
   */
  getNode(kind: NodeKind): NodeDefinition | undefined {
    return this.nodes.get(kind);
  }

  /**
   * Get a node definition (required)
   * @throws RRError if the node is not registered
   */
  getNodeOrThrow(kind: NodeKind): NodeDefinition {
    const def = this.nodes.get(kind);
    if (!def) {
      throw createRRError(RR_ERROR_CODES.UNSUPPORTED_NODE, `Node kind "${kind}" is not registered`);
    }
    return def;
  }

  /**
   * Get a trigger definition
   * @returns Trigger definition or undefined
   */
  getTrigger(kind: TriggerKind): TriggerDefinition | undefined {
    return this.triggers.get(kind);
  }

  /**
   * Get a trigger definition (required)
   * @throws RRError if the trigger is not registered
   */
  getTriggerOrThrow(kind: TriggerKind): TriggerDefinition {
    const def = this.triggers.get(kind);
    if (!def) {
      throw createRRError(
        RR_ERROR_CODES.UNSUPPORTED_NODE,
        `Trigger kind "${kind}" is not registered`,
      );
    }
    return def;
  }

  /**
   * Check whether a node is registered
   */
  hasNode(kind: NodeKind): boolean {
    return this.nodes.has(kind);
  }

  /**
   * Check whether a trigger is registered
   */
  hasTrigger(kind: TriggerKind): boolean {
    return this.triggers.has(kind);
  }

  /**
   * Get all registered node kinds
   */
  listNodeKinds(): NodeKind[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Get all registered trigger kinds
   */
  listTriggerKinds(): TriggerKind[] {
    return Array.from(this.triggers.keys());
  }

  /**
   * Register a plugin
   * @description Calls the plugin's register method
   */
  registerPlugin(plugin: RRPlugin): void {
    plugin.register(this);
  }

  /**
   * Register plugins in bulk
   */
  registerPlugins(plugins: RRPlugin[]): void {
    for (const plugin of plugins) {
      this.registerPlugin(plugin);
    }
  }

  /**
   * Clear all registrations
   * @description Mainly for tests
   */
  clear(): void {
    this.nodes.clear();
    this.triggers.clear();
  }
}

/** Global plugin registry instance */
let globalRegistry: PluginRegistry | null = null;

/**
 * Get the global plugin registry
 */
export function getPluginRegistry(): PluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new PluginRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global plugin registry
 * @description Mainly for tests
 */
export function resetPluginRegistry(): void {
  globalRegistry = null;
}
