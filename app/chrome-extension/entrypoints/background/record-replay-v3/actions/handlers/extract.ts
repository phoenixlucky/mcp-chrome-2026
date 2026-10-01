/**
 * Extract Action Handler
 *
 * Extracts data from the page and stores in variables:
 * - selector mode: Extract text/attribute from elements
 * - js mode: Execute JavaScript and capture return value
 */

import { failed, invalid, ok, tryResolveString } from '../registry';
import type { ActionHandler, BrowserWorld, JsonValue, VariableStore } from '../types';
import { getMarkerById } from '@/entrypoints/background/element-marker/element-marker-storage';
import { getElementMarkerMembers } from '@/common/element-marker-types';
import { resolveMarkerFrame } from './common';

/** Default attribute to extract */
const DEFAULT_EXTRACT_ATTR = 'textContent';

/**
 * Execute extraction script in page context
 */
async function executeExtraction(
  tabId: number,
  frameId: number | undefined,
  mode: 'selector' | 'js',
  params: {
    selector?: string;
    selectorType?: 'css' | 'xpath';
    attr?: string;
    code?: string;
    world?: BrowserWorld;
  },
): Promise<{ ok: true; value: JsonValue } | { ok: false; error: string }> {
  const frameIds = typeof frameId === 'number' ? [frameId] : undefined;
  const world = params.world === 'ISOLATED' ? 'ISOLATED' : 'MAIN';

  try {
    if (mode === 'selector') {
      const injected = await chrome.scripting.executeScript({
        target: { tabId, frameIds } as chrome.scripting.InjectionTarget,
        world,
        func: (selector: string, selectorType: 'css' | 'xpath', attr: string) => {
          const el =
            selectorType === 'xpath'
              ? (document.evaluate(
                  selector,
                  document,
                  null,
                  XPathResult.FIRST_ORDERED_NODE_TYPE,
                  null,
                ).singleNodeValue as Element | null)
              : document.querySelector(selector);
          if (!el) {
            return { success: false, error: `Element not found: ${selector}` };
          }

          let value: JsonValue;

          // Handle special attribute names
          if (attr === 'text' || attr === 'textContent') {
            value = el.textContent?.trim() ?? '';
          } else if (attr === 'innerText') {
            value = (el as HTMLElement).innerText?.trim() ?? '';
          } else if (attr === 'innerHTML') {
            value = el.innerHTML;
          } else if (attr === 'outerHTML') {
            value = el.outerHTML;
          } else if (attr === 'value') {
            // For form elements
            value = (el as HTMLInputElement).value ?? '';
          } else if (attr === 'checked') {
            value = (el as HTMLInputElement).checked ?? false;
          } else if (attr === 'href') {
            value = (el as HTMLAnchorElement).href ?? el.getAttribute('href') ?? '';
          } else if (attr === 'src') {
            value = (el as HTMLImageElement).src ?? el.getAttribute('src') ?? '';
          } else {
            // Generic attribute
            const attrValue = el.getAttribute(attr);
            value = attrValue ?? '';
          }

          return { success: true, value };
        },
        args: [params.selector!, params.selectorType || 'css', params.attr!],
      });

      const result = Array.isArray(injected) ? injected[0]?.result : undefined;
      if (!result || typeof result !== 'object') {
        return { ok: false, error: 'Extraction script returned invalid result' };
      }

      if (!result.success) {
        return { ok: false, error: result.error || 'Extraction failed' };
      }

      return { ok: true, value: result.value as JsonValue };
    }

    // JS mode
    const injected = await chrome.scripting.executeScript({
      target: { tabId, frameIds } as chrome.scripting.InjectionTarget,
      world,
      func: (code: string) => {
        try {
          // Create function and execute
          const fn = new Function(code);
          const result = fn();

          // Handle promises
          if (result instanceof Promise) {
            return result.then(
              (value: unknown) => ({ success: true, value }),
              (error: Error) => ({ success: false, error: error?.message || String(error) }),
            );
          }

          return { success: true, value: result };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
      },
      args: [params.code!],
    });

    const result = Array.isArray(injected) ? injected[0]?.result : undefined;

    // Handle async result
    if (result instanceof Promise) {
      const asyncResult = await result;
      if (!asyncResult || typeof asyncResult !== 'object') {
        return { ok: false, error: 'Async extraction returned invalid result' };
      }
      if (!asyncResult.success) {
        return { ok: false, error: asyncResult.error || 'Extraction failed' };
      }
      return { ok: true, value: asyncResult.value as JsonValue };
    }

    if (!result || typeof result !== 'object') {
      return { ok: false, error: 'Extraction script returned invalid result' };
    }

    const typedResult = result as { success: boolean; value?: unknown; error?: string };
    if (!typedResult.success) {
      return { ok: false, error: typedResult.error || 'Extraction failed' };
    }

    return { ok: true, value: typedResult.value as JsonValue };
  } catch (e) {
    return {
      ok: false,
      error: `Script execution failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Resolve extraction parameters
 */
function resolveExtractParams(
  params: unknown,
  vars: VariableStore,
): { ok: true; mode: 'selector' | 'js'; resolved: ResolvedParams } | { ok: false; error: string } {
  const p = params as {
    mode: 'selector' | 'js';
    selector?: unknown;
    attr?: unknown;
    markerId?: string;
    memberId?: string;
    extractAllMembers?: boolean;
    markerValueType?: 'text' | 'href' | 'src' | 'value';
    code?: string;
    world?: BrowserWorld;
    saveAs: string;
  };

  if (p.mode === 'selector') {
    if (p.markerId) {
      return {
        ok: true,
        mode: 'selector',
        resolved: {
          selector: '',
          attr: p.markerValueType || 'text',
          saveAs: p.saveAs,
          markerId: p.markerId,
          memberId: p.memberId,
          extractAllMembers: p.extractAllMembers === true,
        },
      };
    }
    const selectorResult = tryResolveString(p.selector as string, vars);
    if (!selectorResult.ok) return selectorResult;
    const selector = selectorResult.value.trim();
    if (!selector) return { ok: false, error: 'Empty selector' };

    let attr = DEFAULT_EXTRACT_ATTR;
    if (p.attr !== undefined && p.attr !== null) {
      const attrResult = tryResolveString(p.attr as string, vars);
      if (!attrResult.ok) return attrResult;
      attr = attrResult.value.trim() || DEFAULT_EXTRACT_ATTR;
    }

    return {
      ok: true,
      mode: 'selector',
      resolved: { selector, attr, saveAs: p.saveAs },
    };
  }

  if (p.mode === 'js') {
    if (!p.code || typeof p.code !== 'string') {
      return { ok: false, error: 'JS mode requires code string' };
    }
    return {
      ok: true,
      mode: 'js',
      resolved: { code: p.code, world: p.world, saveAs: p.saveAs },
    };
  }

  return { ok: false, error: `Unknown extract mode: ${String(p.mode)}` };
}

type ResolvedParams =
  | {
      selector: string;
      attr: string;
      saveAs: string;
      markerId?: string;
      memberId?: string;
      extractAllMembers?: boolean;
    }
  | { code: string; world?: BrowserWorld; saveAs: string };

export const extractHandler: ActionHandler<'extract'> = {
  type: 'extract',

  validate: (action) => {
    const params = action.params as {
      mode: string;
      selector?: unknown;
      code?: string;
      saveAs?: string;
      markerId?: string;
    };

    if (params.mode !== 'selector' && params.mode !== 'js') {
      return invalid(`Invalid extract mode: ${String(params.mode)}`);
    }

    if (!params.saveAs || typeof params.saveAs !== 'string' || params.saveAs.trim().length === 0) {
      return invalid('Extract action requires a non-empty saveAs variable name');
    }

    if (params.mode === 'selector' && !params.markerId && params.selector === undefined) {
      return invalid('Selector mode requires a selector');
    }

    if (params.mode === 'js' && (!params.code || typeof params.code !== 'string')) {
      return invalid('JS mode requires a code string');
    }

    return ok();
  },

  describe: (action) => {
    const params = action.params as { mode: string; saveAs?: string };
    const varName = params.saveAs || '?';
    return params.mode === 'js' ? `Extract JS → ${varName}` : `Extract → ${varName}`;
  },

  run: async (ctx, action) => {
    const tabId = ctx.tabId;
    if (typeof tabId !== 'number') {
      return failed('TAB_NOT_FOUND', 'No active tab found for extract action');
    }

    const resolved = resolveExtractParams(action.params, ctx.vars);
    if (!resolved.ok) {
      return failed('VALIDATION_ERROR', resolved.error);
    }

    const extractParams =
      resolved.mode === 'selector'
        ? {
            selector: (resolved.resolved as { selector: string }).selector,
            attr: (resolved.resolved as { attr: string }).attr,
          }
        : {
            code: (resolved.resolved as { code: string }).code,
            world: (resolved.resolved as { world?: BrowserWorld }).world,
          };

    const markerParams = resolved.resolved as Extract<ResolvedParams, { selector: string }>;
    if (resolved.mode === 'selector' && markerParams.markerId) {
      const marker = await getMarkerById(markerParams.markerId);
      if (!marker)
        return failed('TARGET_NOT_FOUND', `Saved marker not found: ${markerParams.markerId}`);
      const members = getElementMarkerMembers(marker);
      const oneMember =
        members.find((member) => member.id === markerParams.memberId) ||
        (members.length === 1 && !markerParams.memberId ? members[0] : undefined);
      const selected = markerParams.extractAllMembers ? members : oneMember ? [oneMember] : [];
      if (!selected.length) {
        return failed('TARGET_NOT_FOUND', `Choose a member from marker "${marker.name}"`);
      }
      const rows: JsonValue[] = [];
      for (const member of selected) {
        const frame = await resolveMarkerFrame(tabId, member);
        if (!frame.ok) {
          rows.push({ marker: marker.name, member: member.name, value: '', error: frame.error });
          continue;
        }
        const extracted = await executeExtraction(tabId, frame.frameId, 'selector', {
          selector: member.selector,
          selectorType: member.selectorType || 'css',
          attr: markerParams.attr,
        });
        rows.push(
          extracted.ok
            ? { marker: marker.name, member: member.name, value: extracted.value }
            : { marker: marker.name, member: member.name, value: '', error: extracted.error },
        );
      }
      const value: JsonValue = markerParams.extractAllMembers ? rows : (rows[0] as JsonValue);
      ctx.vars[markerParams.saveAs] = value;
      return { status: 'success', output: { value } };
    }

    const result = await executeExtraction(tabId, ctx.frameId, resolved.mode, extractParams);

    if (!result.ok) {
      return failed('SCRIPT_FAILED', result.error);
    }

    // Store in variables
    const saveAs = (resolved.resolved as { saveAs: string }).saveAs;
    ctx.vars[saveAs] = result.value;

    return {
      status: 'success',
      output: { value: result.value },
    };
  },
};
