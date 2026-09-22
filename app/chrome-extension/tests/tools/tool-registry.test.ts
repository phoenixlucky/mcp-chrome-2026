import { describe, expect, it } from 'vitest';
import { browserToolExports } from '@/entrypoints/background/tools';
import { createToolRegistry } from '@/entrypoints/background/tools/tool-registry';
import { TOOL_SCHEMAS } from '@ethanwilkins/chrome-mcp-shared-2026';

const tool = (name: string) => ({
  name,
  execute: async () => ({ content: [{ type: 'text' as const, text: name }] }),
});

describe('createToolRegistry', () => {
  it('registers only executable named tools', () => {
    const registry = createToolRegistry({
      first: tool('first'),
      ignored: { name: 'ignored' },
      alsoIgnored: null,
      second: tool('second'),
    });

    expect([...registry.keys()]).toEqual(['first', 'second']);
  });

  it('rejects duplicate tool names instead of silently overwriting', () => {
    expect(() =>
      createToolRegistry({
        first: tool('same'),
        second: tool('same'),
      }),
    ).toThrow('Duplicate browser tool name: same');
  });

  it('covers every public schema tool exactly once', () => {
    const registry = createToolRegistry(browserToolExports);
    const nativeOnlyTools = new Set(['chrome_profile', 'chrome_batch']);
    const schemaNames = TOOL_SCHEMAS.filter((schema) => !nativeOnlyTools.has(schema.name))
      .map((schema) => schema.name)
      .sort();

    expect([...registry.keys()].sort()).toEqual(schemaNames);
  });
});
