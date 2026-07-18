import { describe, expect, it } from 'vitest';

import { PluginRegistry } from '@/entrypoints/background/record-replay-v3/engine/plugins/registry';
import { registerActionNodes } from '@/entrypoints/background/record-replay-v3/engine/plugins/register-action-nodes';

function context(vars: Record<string, any>, executeSubflow: (id: string, vars: Record<string, any>) => Promise<any>) {
  return {
    runId: 'run' as any,
    flow: {} as any,
    nodeId: 'node' as any,
    tabId: 1,
    vars,
    log: () => {},
    chooseNext: (label: string) => ({ kind: 'edgeLabel' as const, label }),
    executeSubflow,
    artifacts: { screenshot: async () => ({ ok: true as const, base64: '' }) },
    persistent: { get: async () => undefined, set: async () => {}, delete: async () => {} },
  };
}

describe('V3 native loop nodes', () => {
  it('runs a subflow once for every foreach item and returns the final variables', async () => {
    const registry = new PluginRegistry();
    registerActionNodes(registry);
    const seen: string[] = [];
    const result = await registry.getNodeOrThrow('foreach').execute(
      context({ values: ['a', 'b'] }, async (id, vars) => {
        expect(id).toBe('body');
        seen.push(String(vars.item));
        vars.last = vars.item;
        return { ok: true };
      }) as any,
      { id: 'loop', kind: 'foreach', config: { listVar: 'values', itemVar: 'item', subflowId: 'body' } } as any,
    );
    expect(result.status).toBe('succeeded');
    expect(seen).toEqual(['a', 'b']);
    expect(result.varsPatch).toEqual(expect.arrayContaining([
      { op: 'set', name: 'item', value: 'b' },
      { op: 'set', name: 'last', value: 'b' },
    ]));
  });

  it('re-evaluates while conditions after every subflow execution', async () => {
    const registry = new PluginRegistry();
    registerActionNodes(registry);
    const result = await registry.getNodeOrThrow('while').execute(
      context({ count: 0 }, async (_id, vars) => {
        vars.count = Number(vars.count) + 1;
        return { ok: true };
      }) as any,
      {
        id: 'loop',
        kind: 'while',
        config: {
          subflowId: 'body',
          maxIterations: 10,
          condition: {
            kind: 'compare',
            left: { kind: 'var', ref: { name: 'count' } },
            op: 'lt',
            right: 3,
          },
        },
      } as any,
    );
    expect(result.status).toBe('succeeded');
    expect(result.varsPatch).toEqual(expect.arrayContaining([{ op: 'set', name: 'count', value: 3 }]));
  });
});
