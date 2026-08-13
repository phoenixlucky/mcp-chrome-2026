import { createErrorResponse, type ToolResult } from '@/common/tool-handler';
import { ERROR_MESSAGES } from '@/common/constants';
import { listMarkersForUrl } from '@/entrypoints/background/element-marker/element-marker-storage';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { BaseBrowserToolExecutor } from '../base-browser';

interface LocateElementParams {
  markerId?: string;
  markerName?: string;
  ref?: string;
  selector?: string;
  selectorType?: 'css' | 'xpath';
  text?: string;
  role?: string;
  ariaLabel?: string;
  testId?: string;
  name?: string;
  allowMultiple?: boolean;
  scrollIntoView?: boolean;
  highlight?: boolean;
  timeout?: number;
  tabId?: number;
  windowId?: number;
  frameId?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30_000;
const RETRY_INTERVAL_MS = 150;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimeout(value: unknown): number {
  if (value === undefined || value === null) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(parsed), MAX_TIMEOUT_MS);
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function markerSummary(marker: any): Record<string, unknown> {
  return {
    id: marker.id,
    name: marker.name,
    selector: marker.selector,
    selectorType: marker.selectorType || 'css',
    listMode: !!marker.listMode,
    matchType: marker.matchType || 'prefix',
    action: marker.action || 'custom',
  };
}

class ElementLocatorTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.LOCATE_ELEMENT;

  async execute(args: LocateElementParams = {}): Promise<ToolResult> {
    const timeoutMs = normalizeTimeout(args.timeout);

    try {
      const explicit = await this.tryGetTab(args.tabId);
      const tab = explicit || (await this.getActiveTabOrThrowInWindow(args.windowId));
      if (!tab.id) {
        return createErrorResponse(`${ERROR_MESSAGES.TAB_NOT_FOUND}: Active tab has no ID`);
      }

      const currentUrl = String(tab.url || '');
      const markers = currentUrl ? await listMarkersForUrl(currentUrl) : [];
      let marker: any | undefined;

      const markerId = stringValue(args.markerId);
      const markerName = stringValue(args.markerName);
      if (markerId) {
        marker = markers.find((item) => item.id === markerId);
        if (!marker) {
          return createErrorResponse(
            `Element marker "${markerId}" was not found for the current URL`,
          );
        }
      } else if (markerName) {
        const normalized = normalizeName(markerName);
        const matches = markers.filter(
          (item) => normalizeName(String(item.name || '')) === normalized,
        );
        if (matches.length > 1) {
          return createErrorResponse(
            `Element marker name "${markerName}" matched multiple markers; use markerId instead`,
          );
        }
        marker = matches[0];
        if (!marker) {
          return createErrorResponse(
            `Element marker "${markerName}" was not found for the current URL`,
          );
        }
      }

      const selector = marker?.selector || stringValue(args.selector) || undefined;
      const selectorType = marker?.selectorType || args.selectorType || 'css';
      const ref = marker ? undefined : stringValue(args.ref) || undefined;
      const allowMultiple =
        typeof args.allowMultiple === 'boolean' ? args.allowMultiple : !!marker?.listMode;

      if (
        !marker &&
        !ref &&
        !selector &&
        !stringValue(args.text) &&
        !stringValue(args.role) &&
        !stringValue(args.ariaLabel) &&
        !stringValue(args.testId) &&
        !stringValue(args.name)
      ) {
        return createErrorResponse(
          `${ERROR_MESSAGES.INVALID_PARAMETERS}: provide markerId, markerName, ref, selector, text, role, ariaLabel, testId, or name`,
        );
      }

      await this.injectContentScript(
        tab.id,
        ['inject-scripts/accessibility-tree-helper.js'],
        false,
        'ISOLATED',
        true,
        typeof args.frameId === 'number' ? [args.frameId] : undefined,
      );

      const request = {
        action: 'locateElement',
        ref,
        selector,
        selectorType,
        text: stringValue(args.text) || undefined,
        role: stringValue(args.role) || undefined,
        ariaLabel: stringValue(args.ariaLabel) || undefined,
        testId: stringValue(args.testId) || undefined,
        name: stringValue(args.name) || undefined,
        allowMultiple,
        scrollIntoView: args.scrollIntoView !== false,
        highlight: args.highlight !== false,
      };

      const deadline = Date.now() + timeoutMs;
      let lastError = 'Element was not found';
      while (true) {
        const result = await this.sendMessageToTab(tab.id, request, args.frameId);
        if (result?.success) {
          const output = {
            success: true,
            tabId: tab.id,
            frameId: typeof args.frameId === 'number' ? args.frameId : 0,
            resolutionSource: marker ? (markerId ? 'markerId' : 'markerName') : result.resolvedBy,
            marker: marker ? markerSummary(marker) : null,
            ...result,
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            isError: false,
          };
        }

        lastError = String(result?.error || lastError);
        // Ambiguous selectors and locators are deterministic; retrying only adds latency.
        if (result?.matchCount > 1 && /multiple|equally likely/i.test(lastError)) break;
        if (Date.now() >= deadline) break;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(RETRY_INTERVAL_MS, deadline - Date.now())),
        );
      }

      return createErrorResponse(`${lastError} (waited ${timeoutMs}ms)`);
    } catch (error) {
      return createErrorResponse(
        `${ERROR_MESSAGES.TOOL_EXECUTION_FAILED}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const elementLocatorTool = new ElementLocatorTool();
