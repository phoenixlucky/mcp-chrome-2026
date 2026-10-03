import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
import { STEP_TYPES } from '@ethanwilkins/chrome-mcp-shared-2026';

export function validateNode(n: NodeBase): string[] {
  const errs: string[] = [];
  const c: any = n.config || {};

  switch (n.type) {
    case STEP_TYPES.CLICK:
    case STEP_TYPES.DBLCLICK:
    case 'fill': {
      const hasCandidate = !!c?.target?.candidates?.length;
      if (!hasCandidate) errs.push('Missing target selector candidate');
      if (n.type === 'fill' && (!('value' in c) || c.value === undefined))
        errs.push('Missing input value');
      break;
    }
    case STEP_TYPES.WAIT: {
      if (!c?.condition) errs.push('Missing wait condition');
      break;
    }
    case STEP_TYPES.ASSERT: {
      if (!c?.assert) errs.push('Missing assert condition');
      break;
    }
    case STEP_TYPES.NAVIGATE: {
      if (!c?.url) errs.push('Missing URL');
      break;
    }
    case STEP_TYPES.HTTP: {
      if (!c?.url) errs.push('HTTP: missing URL');
      if (c?.assign && typeof c.assign === 'object') {
        const pathRe = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+|\[\d+\])*$/;
        for (const v of Object.values(c.assign)) {
          const s = String(v);
          if (!pathRe.test(s)) errs.push(`Assign: invalid path ${s}`);
        }
      }
      break;
    }
    case STEP_TYPES.HANDLE_DOWNLOAD: {
      // filenameContains is optional
      break;
    }
    case STEP_TYPES.EXTRACT: {
      if (!c?.saveAs) errs.push('Extract: save variable name is required');
      if (!c?.selector && !c?.js) errs.push('Extract: provide selector or js');
      break;
    }
    case STEP_TYPES.SWITCH_TAB: {
      if (!c?.tabId && !c?.urlContains && !c?.titleContains)
        errs.push('SwitchTab: provide tabId or URL/title contains');
      break;
    }
    case STEP_TYPES.SCREENSHOT: {
      // selector may be empty (full page/viewport), not required
      break;
    }
    case STEP_TYPES.TRIGGER_EVENT: {
      const hasCandidate = !!c?.target?.candidates?.length;
      if (!hasCandidate) errs.push('Missing target selector candidate');
      if (!String(c?.event || '').trim()) errs.push('Event type is required');
      break;
    }
    case STEP_TYPES.IF: {
      const arr = Array.isArray(c?.branches) ? c.branches : [];
      if (arr.length === 0) errs.push('Add at least one conditional branch');
      for (let i = 0; i < arr.length; i++) {
        if (!String(arr[i]?.expr || '').trim())
          errs.push(`Branch ${i + 1}: condition expression is required`);
      }
      break;
    }
    case STEP_TYPES.SET_ATTRIBUTE: {
      const hasCandidate = !!c?.target?.candidates?.length;
      if (!hasCandidate) errs.push('Missing target selector candidate');
      if (!String(c?.name || '').trim()) errs.push('Attribute name is required');
      break;
    }
    case STEP_TYPES.LOOP_ELEMENTS: {
      if (!String(c?.selector || '').trim()) errs.push('Element selector is required');
      if (!String(c?.subflowId || '').trim()) errs.push('Subflow ID is required');
      break;
    }
    case STEP_TYPES.SWITCH_FRAME: {
      // Both index/urlContains optional; empty means switch back to top frame
      break;
    }
    case STEP_TYPES.EXECUTE_FLOW: {
      if (!String(c?.flowId || '').trim()) errs.push('Select a workflow to execute');
      break;
    }
    case STEP_TYPES.CLOSE_TAB: {
      // Empty is allowed (closes the current tab), not required
      break;
    }
    case STEP_TYPES.SCRIPT: {
      // If saveAs/assign is configured, code should be provided
      const hasAssign = c?.assign && Object.keys(c.assign).length > 0;
      if ((c?.saveAs || hasAssign) && !String(c?.code || '').trim())
        errs.push('Script: save/assign configured but code is missing');
      if (hasAssign) {
        const pathRe = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+|\[\d+\])*$/;
        for (const v of Object.values(c.assign || {})) {
          const s = String(v);
          if (!pathRe.test(s)) errs.push(`Assign: invalid path ${s}`);
        }
      }
      break;
    }
  }
  return errs;
}

export function validateFlow(nodes: NodeBase[]): {
  totalErrors: number;
  nodeErrors: Record<string, string[]>;
} {
  const nodeErrors: Record<string, string[]> = {};
  let totalErrors = 0;
  for (const n of nodes) {
    const e = validateNode(n);
    if (e.length) {
      nodeErrors[n.id] = e;
      totalErrors += e.length;
    }
  }
  return { totalErrors, nodeErrors };
}
