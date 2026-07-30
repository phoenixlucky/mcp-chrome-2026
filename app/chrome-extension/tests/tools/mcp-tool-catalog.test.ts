import { describe, expect, it } from 'vitest';
import { TOOL_SCHEMAS } from '@ethanwilkins/chrome-mcp-shared-2026';

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
      ]),
    );
    expect(search?.inputSchema.required).toEqual(expect.arrayContaining(['query', 'tabIds']));
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
});
