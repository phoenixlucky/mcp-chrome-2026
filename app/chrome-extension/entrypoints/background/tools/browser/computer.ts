import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { ERROR_MESSAGES, TIMEOUTS } from '@/common/constants';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { clickTool, fillTool } from './interaction';
import { CDPHelper } from './cdp-input';
import { ComputerActionBase } from './computer-actions';
import { keyboardTool } from './keyboard';
import { screenshotTool } from './screenshot';
import { screenshotContextManager, scaleCoordinates } from '@/utils/screenshot-context';
import {} from './gif-recorder';
import { requireForegroundWindow, resolveBackgroundMode } from './common';
import { scrollTool } from './scroll';

export type MouseButton = 'left' | 'right' | 'middle';

export interface Coordinates {
  x: number;
  y: number;
}

export interface ZoomRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Modifiers {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface ComputerParams {
  action:
    | 'left_click'
    | 'right_click'
    | 'double_click'
    | 'triple_click'
    | 'left_click_drag'
    | 'scroll'
    | 'type'
    | 'key'
    | 'hover'
    | 'wait'
    | 'fill'
    | 'fill_form'
    | 'resize_page'
    | 'scroll_to'
    | 'zoom'
    | 'screenshot';
  // click/scroll coordinates in screenshot space (if screenshot context exists) or viewport space
  coordinates?: Coordinates; // for click/scroll; for drag, this is endCoordinates
  startCoordinates?: Coordinates; // for drag start
  // Optional element refs (from chrome_read_page) as alternative to coordinates
  ref?: string; // click target or drag end
  startRef?: string; // drag start
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
  scrollAmount?: number;
  text?: string; // for type/key
  repeat?: number; // for key action (1-100)
  modifiers?: Modifiers; // for click actions
  region?: ZoomRegion; // for zoom action
  duration?: number; // seconds for wait
  // For fill
  selector?: string;
  selectorType?: 'css' | 'xpath'; // Type of selector (default: 'css')
  value?: string;
  frameId?: number; // Target frame for selector/ref resolution
  tabId?: number; // target existing tab id
  windowId?: number;
  background?: boolean; // avoid focusing/activating
}

class ComputerTool extends ComputerActionBase {
  name = TOOL_NAMES.BROWSER.COMPUTER;

  async execute(args: ComputerParams): Promise<ToolResult> {
    const params = args || ({} as ComputerParams);
    if (!params.action) return createErrorResponse('Action parameter is required');

    try {
      const tab = await this.resolveTargetTab(args.tabId, args.windowId);
      if (typeof tab.id !== 'number')
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND + ': Active tab has no ID');
      const needsForeground = params.action === 'type' || params.action === 'key';
      const hasDomHoverTarget = params.action === 'hover' && (!!params.ref || !!params.selector);
      const needsPixelSurface =
        needsForeground ||
        params.action === 'left_click' ||
        params.action === 'right_click' ||
        params.action === 'double_click' ||
        params.action === 'triple_click' ||
        params.action === 'left_click_drag' ||
        (params.action === 'hover' && !hasDomHoverTarget) ||
        params.action === 'scroll' ||
        params.action === 'zoom';
      const backgroundMode = await resolveBackgroundMode(tab.id, params.background);
      if (needsPixelSurface && !(params.action === 'scroll' && backgroundMode)) {
        const foregroundError = await requireForegroundWindow(tab.id, `computer:${params.action}`);
        if (foregroundError) return foregroundError;
      }
      if (params.background === false || needsForeground) {
        await this.ensureFocus(tab, { activate: true, focusWindow: true });
      }

      // Execute the action and capture frame on success
      const result = await this.addTargetFeedback(
        await this.executeAction(params, tab, backgroundMode),
        tab,
        needsForeground,
      );

      // Trigger auto-capture on successful actions (except screenshot which is read-only)
      if (!result.isError && params.action !== 'screenshot' && params.action !== 'wait') {
        const actionType = this.mapActionToCapture(params.action);
        if (actionType) {
          // Convert to viewport-space coordinates for GIF overlays
          // params.coordinates may be screenshot-space when screenshot context exists
          const ctx = screenshotContextManager.getContext(tab.id);
          const toViewport = (c?: Coordinates): { x: number; y: number } | undefined => {
            if (!c) return undefined;
            if (!ctx) return { x: c.x, y: c.y };
            const scaled = scaleCoordinates(c.x, c.y, ctx);
            return { x: scaled.x, y: scaled.y };
          };

          const endCoords = toViewport(params.coordinates);
          const startCoords = toViewport(params.startCoordinates);

          await this.triggerAutoCapture(tab.id, actionType, {
            coordinateSpace: 'viewport',
            coordinates: endCoords,
            startCoordinates: startCoords,
            endCoordinates: actionType === 'drag' ? endCoords : undefined,
            text: params.text,
            ref: params.ref,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error in computer tool:', error);
      return createErrorResponse(
        `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const computerTool = new ComputerTool();
