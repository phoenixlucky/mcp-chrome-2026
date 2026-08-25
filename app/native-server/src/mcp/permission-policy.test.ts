import { describe, expect, test } from '@jest/globals';
import {
  checkToolAccess,
  filterToolsByPermission,
  getToolPermissionPolicy,
  isHighRiskTool,
  matchesToolPattern,
} from './permission-policy';

describe('MCP tool permission policy', () => {
  test('supports exact, wildcard, and flow prefix scopes', () => {
    expect(matchesToolPattern('chrome_read_page', 'chrome_read_page')).toBe(true);
    expect(matchesToolPattern('flow.checkout', 'flow.*')).toBe(true);
    expect(matchesToolPattern('chrome_read_page', 'chrome_*')).toBe(true);
    expect(matchesToolPattern('chrome_read_page', 'flow.*')).toBe(false);
  });

  test('requires explicit approval for high-risk tools when configured', () => {
    const policy = getToolPermissionPolicy({
      CHROME_MCP_ALLOWED_TOOLS: 'chrome_read_page,chrome_javascript,flow.*',
      CHROME_MCP_REQUIRE_APPROVAL: 'true',
      CHROME_MCP_APPROVED_TOOLS: 'chrome_read_page',
    });
    expect(isHighRiskTool('chrome_javascript')).toBe(true);
    expect(checkToolAccess('chrome_javascript', policy).reason).toBe('approval');
    expect(checkToolAccess('chrome_read_page', policy).allowed).toBe(true);
    expect(checkToolAccess('flow.checkout', policy).reason).toBe('approval');
  });

  test('filters discovery results using the same policy as calls', () => {
    const policy = getToolPermissionPolicy({
      CHROME_MCP_ALLOWED_TOOLS: 'chrome_read_page,flow.*',
      CHROME_MCP_APPROVED_TOOLS: 'flow.*',
    });
    expect(
      filterToolsByPermission(
        [{ name: 'chrome_read_page' }, { name: 'chrome_javascript' }, { name: 'flow.demo' }],
        policy,
      ).map((tool) => tool.name),
    ).toEqual(['chrome_read_page', 'flow.demo']);
  });
});
