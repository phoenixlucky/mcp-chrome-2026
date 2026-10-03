/**
 * @fileoverview Breakpoint manager
 * @description Manages adding, removing and hit-testing of debug breakpoints
 */

import type { NodeId, RunId } from '../../domain/ids';
import type { Breakpoint, DebuggerState } from '../../domain/debug';

/**
 * Breakpoint manager
 * @description Manages breakpoints for a single Run
 */
export class BreakpointManager {
  private breakpoints = new Map<NodeId, Breakpoint>();
  private stepMode: 'none' | 'stepOver' = 'none';

  constructor(initialBreakpoints?: NodeId[]) {
    if (initialBreakpoints) {
      for (const nodeId of initialBreakpoints) {
        this.add(nodeId);
      }
    }
  }

  /**
   * Add a breakpoint
   */
  add(nodeId: NodeId): void {
    this.breakpoints.set(nodeId, { nodeId, enabled: true });
  }

  /**
   * Remove a breakpoint
   */
  remove(nodeId: NodeId): void {
    this.breakpoints.delete(nodeId);
  }

  /**
   * Set the breakpoint list (replaces all existing breakpoints)
   */
  setAll(nodeIds: NodeId[]): void {
    this.breakpoints.clear();
    for (const nodeId of nodeIds) {
      this.add(nodeId);
    }
  }

  /**
   * Enable a breakpoint
   */
  enable(nodeId: NodeId): void {
    const bp = this.breakpoints.get(nodeId);
    if (bp) {
      bp.enabled = true;
    }
  }

  /**
   * Disable a breakpoint
   */
  disable(nodeId: NodeId): void {
    const bp = this.breakpoints.get(nodeId);
    if (bp) {
      bp.enabled = false;
    }
  }

  /**
   * Check whether a node has an enabled breakpoint
   */
  hasBreakpoint(nodeId: NodeId): boolean {
    const bp = this.breakpoints.get(nodeId);
    return bp?.enabled ?? false;
  }

  /**
   * Check whether execution should pause at the node
   * @description Takes breakpoints and step mode into account
   */
  shouldPauseAt(nodeId: NodeId): boolean {
    // In step mode, always pause
    if (this.stepMode === 'stepOver') {
      return true;
    }
    // Otherwise check breakpoints
    return this.hasBreakpoint(nodeId);
  }

  /**
   * Get all breakpoints
   */
  getAll(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Get enabled breakpoints
   */
  getEnabled(): Breakpoint[] {
    return this.getAll().filter((bp) => bp.enabled);
  }

  /**
   * Set the step mode
   */
  setStepMode(mode: 'none' | 'stepOver'): void {
    this.stepMode = mode;
  }

  /**
   * Get the step mode
   */
  getStepMode(): 'none' | 'stepOver' {
    return this.stepMode;
  }

  /**
   * Clear all breakpoints
   */
  clear(): void {
    this.breakpoints.clear();
    this.stepMode = 'none';
  }
}

/**
 * Breakpoint manager registry
 * @description Manages breakpoint managers for multiple Runs
 */
export class BreakpointRegistry {
  private managers = new Map<RunId, BreakpointManager>();

  /**
   * Get or create a breakpoint manager
   */
  getOrCreate(runId: RunId, initialBreakpoints?: NodeId[]): BreakpointManager {
    let manager = this.managers.get(runId);
    if (!manager) {
      manager = new BreakpointManager(initialBreakpoints);
      this.managers.set(runId, manager);
    }
    return manager;
  }

  /**
   * Get a breakpoint manager
   */
  get(runId: RunId): BreakpointManager | undefined {
    return this.managers.get(runId);
  }

  /**
   * Remove a breakpoint manager
   */
  remove(runId: RunId): void {
    this.managers.delete(runId);
  }

  /**
   * Clear everything
   */
  clear(): void {
    this.managers.clear();
  }
}

/** Global breakpoint registry */
let globalBreakpointRegistry: BreakpointRegistry | null = null;

/**
 * Get the global breakpoint registry
 */
export function getBreakpointRegistry(): BreakpointRegistry {
  if (!globalBreakpointRegistry) {
    globalBreakpointRegistry = new BreakpointRegistry();
  }
  return globalBreakpointRegistry;
}

/**
 * Reset the global breakpoint registry
 * @description Mainly for tests
 */
export function resetBreakpointRegistry(): void {
  globalBreakpointRegistry = null;
}
