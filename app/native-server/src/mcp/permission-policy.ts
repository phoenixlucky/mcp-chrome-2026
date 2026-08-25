import {
  MCP_ALLOWED_TOOLS_ENV,
  MCP_APPROVED_TOOLS_ENV,
  MCP_REQUIRE_APPROVAL_ENV,
} from '../constant/index.js';

export interface ToolPermissionPolicy {
  allowedTools: string[];
  approvedTools: string[];
  requireApproval: boolean;
}

export interface ToolAccessDecision {
  allowed: boolean;
  reason?: 'scope' | 'approval';
  message?: string;
}

/** Tools that can change browser state, execute code, send content, or manage profiles. */
export const HIGH_RISK_TOOLS = new Set([
  'chrome_batch',
  'chrome_bookmark_add',
  'chrome_bookmark_delete',
  'chrome_click_element',
  'chrome_close_tabs',
  'chrome_computer',
  'chrome_cookie_delete',
  'chrome_cookie_set',
  'chrome_fill_or_select',
  'chrome_handle_dialog',
  'chrome_javascript',
  'chrome_keyboard',
  'chrome_navigate',
  'chrome_paste_image',
  'chrome_paste_text',
  'chrome_post_to_x',
  'chrome_profile',
  'chrome_scroll',
  'chrome_select_all_items',
  'chrome_storage_delete',
  'chrome_storage_set',
  'chrome_upload_file',
  'chrome_userscript',
]);

function splitPatterns(value: string | undefined, fallback: string[]): string[] {
  const patterns = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return patterns.length > 0 ? patterns : fallback;
}

function envFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

export function getToolPermissionPolicy(
  env: NodeJS.ProcessEnv = process.env,
): ToolPermissionPolicy {
  return {
    allowedTools: splitPatterns(env[MCP_ALLOWED_TOOLS_ENV], ['*']),
    approvedTools: splitPatterns(env[MCP_APPROVED_TOOLS_ENV], []),
    requireApproval: envFlag(env[MCP_REQUIRE_APPROVAL_ENV]),
  };
}

/** Supports exact names, `*`, and simple trailing-prefix patterns such as `flow.*`. */
export function matchesToolPattern(toolName: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) return toolName.startsWith(pattern.slice(0, -1));
  return toolName === pattern;
}

export function matchesAnyToolPattern(toolName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesToolPattern(toolName, pattern));
}

export function isHighRiskTool(toolName: string): boolean {
  return toolName.startsWith('flow.') || HIGH_RISK_TOOLS.has(toolName);
}

export function checkToolAccess(
  toolName: string,
  policy: ToolPermissionPolicy = getToolPermissionPolicy(),
): ToolAccessDecision {
  if (!matchesAnyToolPattern(toolName, policy.allowedTools)) {
    return {
      allowed: false,
      reason: 'scope',
      message: `Tool "${toolName}" is not in CHROME_MCP_ALLOWED_TOOLS.`,
    };
  }

  const approvalGateEnabled = policy.requireApproval || policy.approvedTools.length > 0;
  if (
    approvalGateEnabled &&
    isHighRiskTool(toolName) &&
    !matchesAnyToolPattern(toolName, policy.approvedTools)
  ) {
    return {
      allowed: false,
      reason: 'approval',
      message: `Tool "${toolName}" is high-risk and is not in CHROME_MCP_APPROVED_TOOLS.`,
    };
  }

  return { allowed: true };
}

export function filterToolsByPermission<T extends { name: string }>(
  tools: T[],
  policy: ToolPermissionPolicy = getToolPermissionPolicy(),
): T[] {
  return tools.filter((tool) => checkToolAccess(tool.name, policy).allowed);
}
