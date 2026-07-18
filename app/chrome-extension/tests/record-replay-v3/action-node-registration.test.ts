import { describe, expect, it } from 'vitest';
import { PluginRegistry } from '@/entrypoints/background/record-replay-v3/engine/plugins/registry';
import {
  registerActionNodes,
  UNSUPPORTED_ACTION_KINDS,
} from '@/entrypoints/background/record-replay-v3/engine/plugins/register-action-nodes';

describe('V3 action node registration', () => {
  it('registers V3-native control-flow nodes', () => {
    const registry = new PluginRegistry();
    const kinds = registerActionNodes(registry, { exclude: [...UNSUPPORTED_ACTION_KINDS] });

    expect(kinds).toContain('click');
    expect(kinds).toContain('foreach');
    expect(kinds).toContain('while');
    expect(registry.getNode('click')).toBeDefined();
  });
});
