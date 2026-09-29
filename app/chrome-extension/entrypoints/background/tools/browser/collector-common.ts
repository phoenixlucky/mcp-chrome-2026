import type { ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import type { Field } from './review-utils';

const COLLECTOR_CDP_TIMEOUT_MS = 10_000;
export const BACKGROUND_LAYOUT_RETRY_WAIT_MS = 400;

export type Target = { tabId?: number; windowId?: number; frameSelector?: string };
export type Candidate = { selector?: string; text?: string; role?: string; type?: 'css' | 'xpath' };
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const result = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  isError,
});

export type CollectionScroll = {
  step?: number;
  waitMs?: number;
  waitTimeoutMs?: number;
  settleMs?: number;
  stalledLimit?: number;
  rescanUp?: boolean;
  background?: boolean;
  containerSelector?: string;
  anchorSelector?: string;
};

export type CollectionStopWhen = {
  type: 'textMatch' | 'selector' | 'stable' | 'networkIdle' | 'networkComplete' | 'jsCondition';
  pattern?: string;
  selector?: string;
  urlPattern?: string;
  condition?: string;
  stableRounds?: number;
};

export type CollectionState = {
  seenIds?: string[];
  scrollY?: number;
  pageUrl?: string;
  containerTarget?: string;
};

export type CollectionArgs = Target & {
  cardSelector: string;
  fields: Field[];
  identityFields: string[];
  maxItems?: number;
  maxDurationMs?: number;
  returnBatches?: boolean;
  batchSize?: number;
  returnProgress?: boolean;
  progressEverySteps?: number;
  containerSelector?: string;
  anchorSelector?: string;
  scroll?: CollectionScroll;
  stopWhen?: CollectionStopWhen;
  state?: CollectionState;
  background?: boolean;
};

export type ScrollSnapshot = {
  success?: boolean;
  error?: string;
  top: number;
  max: number;
  atTop: boolean;
  atBottom: boolean;
  scrollHeight: number;
  clientHeight: number;
  cardCount: number;
  cardSample: string;
  busy: boolean;
  target: string;
  visibilityState?: string;
};

export function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeIdentityPart(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function identityKey(record: Record<string, unknown>, fields: string[]): string {
  const parts = fields.map((field) => normalizeIdentityPart(record[field]));
  if (parts.some(Boolean)) return JSON.stringify(parts);
  return `record:${JSON.stringify(record)}`;
}

export function parseResult(result: ToolResult): Record<string, any> {
  const text = result.content.find((item) => item.type === 'text') as { text?: string } | undefined;
  if (!text?.text) return {};
  try {
    return JSON.parse(text.text);
  } catch {
    return { success: !result.isError, raw: text.text };
  }
}

export function framePrelude(frameSelector?: string): string {
  return frameSelector
    ? `const frame = document.querySelector(${JSON.stringify(frameSelector)});
       if (!frame) throw new Error('Iframe not found: ${frameSelector}');
       const doc = frame.contentDocument;
       if (!doc) throw new Error('Iframe is cross-origin or unavailable: ${frameSelector}');
       const win = frame.contentWindow || window;`
    : 'const doc = document; const win = window;';
}

export function collectionContainerSelector(args: CollectionArgs): string | undefined {
  return args.containerSelector || args.scroll?.containerSelector;
}

export function collectionAnchorSelector(args: CollectionArgs): string | undefined {
  return args.anchorSelector || args.scroll?.anchorSelector;
}

export abstract class CollectorTool extends BaseBrowserToolExecutor {
  protected async resolveTab(args: Target): Promise<chrome.tabs.Tab> {
    const tab =
      (typeof args.tabId === 'number' ? await this.tryGetTab(args.tabId) : null) ||
      (await this.getActiveTabInWindow(args.windowId));
    if (!tab?.id) throw new Error('target_tab_not_found');
    return tab;
  }

  protected async evaluate(
    tabId: number,
    expression: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await cdpSessionManager.withSession(tabId, 'collector-tools', () =>
      cdpSessionManager.sendCommand(
        tabId,
        'Runtime.evaluate',
        {
          expression,
          returnByValue: true,
          awaitPromise: true,
        },
        { timeoutMs: COLLECTOR_CDP_TIMEOUT_MS, signal },
      ),
    );
    if (response?.exceptionDetails)
      throw new Error(response.exceptionDetails.text || 'page_evaluation_failed');
    return response?.result?.value;
  }
}
