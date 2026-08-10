import { describe, expect, it } from 'vitest';
import { TOOL_SCHEMAS, TOOL_SCHEMAS_EN } from '@ethanwilkins/chrome-mcp-shared-2026';

describe('MCP tool catalog', () => {
  it('exposes maintained tools and omits retired aliases', () => {
    const names = TOOL_SCHEMAS.map((tool) => tool.name);
    const search = TOOL_SCHEMAS.find((tool) => tool.name === 'search_tabs_content');

    expect(names).toEqual(
      expect.arrayContaining([
        'search_tabs_content',
        'chrome_cookie_get',
        'chrome_cookie_set',
        'chrome_cookie_delete',
        'chrome_proxy_diagnostics',
        'chrome_proxy_rotate',
        'collect_virtual_list',
        'collect_virtual_lists',
      ]),
    );
    expect(search?.inputSchema.required).toEqual(expect.arrayContaining(['query', 'tabIds']));
    const collector = TOOL_SCHEMAS.find((tool) => tool.name === 'collect_virtual_list');
    const batchCollector = TOOL_SCHEMAS.find((tool) => tool.name === 'collect_virtual_lists');
    expect(collector?.inputSchema.required).toEqual(
      expect.arrayContaining(['cardSelector', 'fields', 'identityFields']),
    );
    expect(collector?.inputSchema.properties).toEqual(
      expect.objectContaining({
        containerSelector: expect.any(Object),
        returnBatches: expect.any(Object),
        returnProgress: expect.any(Object),
      }),
    );
    expect(batchCollector?.inputSchema.required).toEqual(
      expect.arrayContaining(['targets', 'cardSelector', 'fields', 'identityFields']),
    );
    expect(names).not.toEqual(
      expect.arrayContaining([
        'record_replay_flow_run',
        'record_replay_list_published',
        'chrome_inject_script',
        'chrome_send_command_to_inject_script',
        'chrome_userscript',
      ]),
    );
  });

  it('keeps the bilingual catalog aligned and fully described', () => {
    const names = TOOL_SCHEMAS.map((tool) => tool.name);
    expect(TOOL_SCHEMAS_EN.map((tool) => tool.name)).toEqual(names);
    const han = /\p{Script=Han}/u;
    for (const catalog of [TOOL_SCHEMAS, TOOL_SCHEMAS_EN]) {
      for (const tool of catalog) {
        expect(tool.description?.trim()).toBeTruthy();
        for (const schema of Object.values(tool.inputSchema.properties || {}) as Array<{
          description?: string;
        }>) {
          expect(schema.description?.trim()).toBeTruthy();
        }
      }
    }
    expect(TOOL_SCHEMAS_EN.every((tool) => !han.test(tool.description || ''))).toBe(true);
  });
});
