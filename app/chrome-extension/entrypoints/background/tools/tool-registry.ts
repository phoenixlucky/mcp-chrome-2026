import type { ToolProgressReporter, ToolResult } from '@/common/tool-handler';

export interface BrowserToolExecutor {
  readonly name: string;
  execute(
    args: Record<string, unknown>,
    signal?: AbortSignal,
    reportProgress?: ToolProgressReporter,
  ): Promise<ToolResult>;
}

type UnknownTool = {
  name?: unknown;
  execute?: unknown;
};

/** Build the browser tool registry and fail fast on accidental name collisions. */
export function createToolRegistry(
  exports: Record<string, unknown> | readonly unknown[],
): Map<string, BrowserToolExecutor> {
  const registry = new Map<string, BrowserToolExecutor>();

  const values = Array.isArray(exports) ? exports : Object.values(exports);
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;

    const candidate = value as UnknownTool;
    if (typeof candidate.name !== 'string' || typeof candidate.execute !== 'function') continue;

    if (registry.has(candidate.name)) {
      throw new Error(`Duplicate browser tool name: ${candidate.name}`);
    }

    registry.set(candidate.name, candidate as BrowserToolExecutor);
  }

  return registry;
}
