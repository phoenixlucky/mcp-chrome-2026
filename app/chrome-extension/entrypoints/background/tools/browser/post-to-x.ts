import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { clickTool, fillTool } from './interaction';
import { waitTool } from './wait';

const DEFAULT_EDITOR_SELECTOR =
  '[data-testid="tweetTextarea_0"], [contenteditable="true"][role="textbox"], div[contenteditable="true"]';
const DEFAULT_SUBMIT_SELECTOR = '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]';
const DEFAULT_SUCCESS_SELECTOR = '[data-testid="toast"], [role="status"]';
const MAX_TIMEOUT_MS = 120_000;

interface PostToXParams {
  text: string;
  editorSelector?: string;
  submitSelector?: string;
  successSelector?: string;
  successText?: string;
  timeout?: number;
  tabId?: number;
  windowId?: number;
}

interface ConfirmationSnapshot {
  count: number;
  texts: string[];
}

function parsePayload(result: ToolResult): Record<string, any> {
  const content = result.content?.[0];
  if (content?.type !== 'text' || typeof content.text !== 'string') return {};
  try {
    const parsed = JSON.parse(content.text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function sameText(actual: unknown, expected: string): boolean {
  return (
    String(actual ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim() ===
    expected
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim()
  );
}

function postResult(
  status: 'published' | 'failed' | 'unknown',
  data: Record<string, unknown>,
  isError = false,
): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ status, ...data }) }],
    isError,
  };
}

async function readConfirmationSnapshot(
  tabId: number,
  selector: string,
): Promise<ConfirmationSnapshot> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      args: [selector],
      func: (targetSelector: string) => {
        const visible = (element: Element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const elements = Array.from(document.querySelectorAll(targetSelector)).filter(visible);
        return {
          count: elements.length,
          texts: elements.map((element) => (element.textContent || '').trim()).filter(Boolean),
        };
      },
    });
    const value = results?.[0]?.result;
    if (!value || typeof value !== 'object') return { count: 0, texts: [] };
    const snapshot = value as { count?: unknown; texts?: unknown };
    return {
      count: typeof snapshot.count === 'number' ? snapshot.count : 0,
      texts: Array.isArray(snapshot.texts) ? snapshot.texts.map(String) : [],
    };
  } catch {
    // Confirmation is best-effort. Restricted pages should return unknown after the click.
    return { count: 0, texts: [] };
  }
}

function confirmationCondition(
  selector: string,
  before: ConfirmationSnapshot,
  successText?: string,
): string {
  return `(() => {
    const targetSelector = ${JSON.stringify(selector)};
    const expectedText = ${JSON.stringify(successText || '')};
    const previousTexts = ${JSON.stringify(before.texts)};
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
    };
    const elements = Array.from(document.querySelectorAll(targetSelector)).filter(visible);
    const changedCount = elements.length > ${before.count};
    const changedText = expectedText && elements.some((element) => {
      const text = (element.textContent || '').trim();
      return text.includes(expectedText) && !previousTexts.includes(text);
    });
    return Boolean(changedCount || changedText);
  })()`;
}

class PostToXTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.POST_TO_X;

  async execute(args: PostToXParams, signal?: AbortSignal): Promise<ToolResult> {
    const text = typeof args.text === 'string' ? args.text : '';
    if (!text.trim()) return createErrorResponse('text must be a non-empty string');

    const timeout = Math.min(
      Math.max(typeof args.timeout === 'number' ? args.timeout : 20_000, 1_000),
      MAX_TIMEOUT_MS,
    );
    const tab =
      typeof args.tabId === 'number'
        ? await this.tryGetTab(args.tabId)
        : await this.getActiveTabOrThrowInWindow(args.windowId);
    if (!tab?.id) return createErrorResponse('Target X tab was not found');

    const url = String(tab.url || '');
    if (!/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)(?:\/|$)/i.test(url)) {
      return createErrorResponse(
        `chrome_post_to_x requires an X/Twitter tab, got ${url || 'unknown URL'}`,
      );
    }

    const editorSelector = args.editorSelector || DEFAULT_EDITOR_SELECTOR;
    const submitSelector = args.submitSelector || DEFAULT_SUBMIT_SELECTOR;
    const successSelector = args.successSelector || DEFAULT_SUCCESS_SELECTOR;

    const editorReady = await waitTool.execute({
      selector: editorSelector,
      waitFor: 'visible',
      timeout,
      tabId: tab.id,
    });
    const editorReadyData = parsePayload(editorReady);
    if (editorReady.isError || editorReadyData.found !== true) {
      return postResult(
        'failed',
        {
          stage: 'editor',
          error: 'X post editor was not visible before timeout',
          tabId: tab.id,
          url,
        },
        true,
      );
    }

    if (signal?.aborted) return createErrorResponse('Tool call cancelled');
    const fill = await fillTool.execute({
      selector: editorSelector,
      value: text,
      tabId: tab.id,
    });
    const fillData = parsePayload(fill);
    const actualText = fillData.elementInfo?.value;
    if (fill.isError || !sameText(actualText, text)) {
      return postResult(
        'failed',
        {
          stage: 'editor',
          error: fillData.error || 'Editor content did not match the requested post text',
          expectedText: text,
          actualText: actualText ?? null,
          tabId: tab.id,
          url,
        },
        true,
      );
    }

    const submitReady = await waitTool.execute({
      selector: submitSelector,
      waitFor: 'enabled',
      timeout,
      tabId: tab.id,
    });
    const submitReadyData = parsePayload(submitReady);
    if (submitReady.isError || submitReadyData.found !== true) {
      return postResult(
        'failed',
        {
          stage: 'submit',
          error: 'X post button was not enabled before timeout',
          tabId: tab.id,
          url,
        },
        true,
      );
    }

    const beforeConfirmation = await readConfirmationSnapshot(tab.id, successSelector);
    const click = await clickTool.execute({
      selector: submitSelector,
      tabId: tab.id,
      waitForNavigation: false,
      timeout,
    });
    if (click.isError) {
      return postResult(
        'failed',
        {
          stage: 'submit',
          error: parsePayload(click).error || 'X post button click failed',
          tabId: tab.id,
          url,
        },
        true,
      );
    }

    const confirmation = await waitTool.execute({
      jsCondition: confirmationCondition(successSelector, beforeConfirmation, args.successText),
      timeout,
      tabId: tab.id,
    });
    const confirmationData = parsePayload(confirmation);
    if (confirmationData.found === true) {
      return postResult('published', {
        stage: 'confirmed',
        clicked: true,
        confirmation: confirmationData,
        tabId: tab.id,
        url,
        retryRecommended: false,
      });
    }

    // A successful click without observable confirmation is intentionally unknown.
    // Never retry automatically: the post may already have been accepted by X.
    return postResult('unknown', {
      stage: 'confirmation',
      clicked: true,
      confirmation: confirmationData,
      error:
        'The submit click completed, but no new confirmation marker was observed; do not retry automatically.',
      tabId: tab.id,
      url,
      retryRecommended: false,
    });
  }
}

export const postToXTool = new PostToXTool();
