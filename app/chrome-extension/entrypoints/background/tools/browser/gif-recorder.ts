/**
 * GIF Recorder Tool
 *
 * Records browser tab activity as an animated GIF.
 *
 * Features:
 * - Two recording modes:
 *   1. Fixed FPS mode (start): Captures frames at regular intervals
 *   2. Auto-capture mode (auto_start): Captures frames on tool actions
 * - Configurable frame rate, duration, and dimensions
 * - Quality/size optimization options
 * - CDP-based screenshot capture for background recording
 * - Offscreen document encoding via gifenc
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import {
  MessageTarget,
  OFFSCREEN_MESSAGE_TYPES,
  OffscreenMessageType,
} from '@/common/message-types';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { offscreenManager } from '@/utils/offscreen-manager';
import { createImageBitmapFromUrl } from '@/utils/image-utils';
import {
  blobToDataUrl,
  CDP_SESSION_KEY,
  EXPORT_CACHE_LIFETIME_MS,
  getRecordingStatus,
  gifRecorderState,
  normalizePositiveInt,
  startRecording,
  sendToOffscreen,
  stopRecording,
} from './gif-recording-session';
import {
  startAutoCapture,
  stopAutoCapture,
  isAutoCaptureActive,
  getAutoCaptureStatus,
  captureFrameOnAction,
  captureInitialFrame,
  type ActionMetadata,
  type GifEnhancedRenderingConfig,
} from './gif-auto-capture';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FPS = 5;
const DEFAULT_DURATION_MS = 5000;
const DEFAULT_MAX_FRAMES = 50;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DEFAULT_MAX_COLORS = 256;

// ============================================================================
// Types
// ============================================================================

type GifRecorderAction =
  'start' | 'stop' | 'status' | 'auto_start' | 'capture' | 'clear' | 'export';

interface GifRecorderParams {
  action: GifRecorderAction;
  tabId?: number;
  fps?: number;
  durationMs?: number;
  maxFrames?: number;
  width?: number;
  height?: number;
  maxColors?: number;
  filename?: string;
  // Auto-capture mode specific
  captureDelayMs?: number;
  frameDelayCs?: number;
  enhancedRendering?: GifEnhancedRenderingConfig;
  // Manual annotation for action="capture"
  annotation?: string;
  // Export action specific
  download?: boolean; // true to download, false to upload via drag&drop
  coordinates?: { x: number; y: number }; // target position for drag&drop upload
  ref?: string; // element ref for drag&drop upload (alternative to coordinates)
  selector?: string; // CSS selector for drag&drop upload (alternative to coordinates)
}

interface RecordingState {
  isRecording: boolean;
  isStopping: boolean;
  tabId: number;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  frameIntervalMs: number;
  frameDelayCs: number;
  maxFrames: number;
  maxColors: number;
  frameCount: number;
  startTime: number;
  captureTimer: ReturnType<typeof setTimeout> | null;
  captureInProgress: Promise<void> | null;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  filename?: string;
}

interface GifResult {
  success: boolean;
  action: GifRecorderAction;
  tabId?: number;
  frameCount?: number;
  durationMs?: number;
  byteLength?: number;
  downloadId?: number;
  filename?: string;
  fullPath?: string;
  isRecording?: boolean;
  mode?: 'fixed_fps' | 'auto_capture';
  actionsCount?: number;
  error?: string;
  // Clear action specific
  clearedAutoCapture?: boolean;
  clearedFixedFps?: boolean;
  clearedCache?: boolean;
  // Export action specific (drag&drop upload)
  uploadTarget?: {
    x: number;
    y: number;
    tagName?: string;
    id?: string;
  };
}

// ============================================================================
// Tool Implementation
// ============================================================================

class GifRecorderTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GIF_RECORDER;

  async execute(args: GifRecorderParams): Promise<ToolResult> {
    const action = args.action;
    const validActions = ['start', 'stop', 'status', 'auto_start', 'capture', 'clear', 'export'];

    if (!action || !validActions.includes(action)) {
      return createErrorResponse(
        `Parameter [action] is required and must be one of: ${validActions.join(', ')}`,
      );
    }

    try {
      switch (action) {
        case 'start': {
          // Fixed-FPS mode: captures frames at regular intervals
          const tab = await this.resolveGifTargetTab(args.tabId);
          if (!tab?.id) {
            return createErrorResponse(
              typeof args.tabId === 'number'
                ? `Tab not found: ${args.tabId}`
                : 'No active tab found',
            );
          }

          if (this.isRestrictedUrl(tab.url)) {
            return createErrorResponse(
              'Cannot record special browser pages or web store pages due to security restrictions.',
            );
          }

          // Check if auto-capture is active
          if (isAutoCaptureActive(tab.id)) {
            return createErrorResponse(
              'Auto-capture mode is active for this tab. Use action="stop" to stop it first.',
            );
          }

          const fps = normalizePositiveInt(args.fps, DEFAULT_FPS, 30);
          const durationMs = normalizePositiveInt(args.durationMs, DEFAULT_DURATION_MS, 60000);
          const maxFrames = normalizePositiveInt(args.maxFrames, DEFAULT_MAX_FRAMES, 300);
          const width = normalizePositiveInt(args.width, DEFAULT_WIDTH, 1920);
          const height = normalizePositiveInt(args.height, DEFAULT_HEIGHT, 1080);
          const maxColors = normalizePositiveInt(args.maxColors, DEFAULT_MAX_COLORS, 256);

          const result = await startRecording(
            tab.id,
            fps,
            durationMs,
            maxFrames,
            width,
            height,
            maxColors,
            args.filename,
          );

          if (result.success) {
            result.mode = 'fixed_fps';
          }

          return this.buildResponse(result);
        }

        case 'auto_start': {
          // Auto-capture mode: captures frames when tools succeed
          const tab = await this.resolveGifTargetTab(args.tabId);
          if (!tab?.id) {
            return createErrorResponse(
              typeof args.tabId === 'number'
                ? `Tab not found: ${args.tabId}`
                : 'No active tab found',
            );
          }

          if (this.isRestrictedUrl(tab.url)) {
            return createErrorResponse(
              'Cannot record special browser pages or web store pages due to security restrictions.',
            );
          }

          // Check if fixed-FPS recording is active
          if (
            gifRecorderState.recordingState?.isRecording &&
            gifRecorderState.recordingState.tabId === tab.id
          ) {
            return createErrorResponse(
              'Fixed-FPS recording is active for this tab. Use action="stop" to stop it first.',
            );
          }

          // Check if auto-capture is already active
          if (isAutoCaptureActive(tab.id)) {
            return createErrorResponse('Auto-capture is already active for this tab.');
          }

          const width = normalizePositiveInt(args.width, DEFAULT_WIDTH, 1920);
          const height = normalizePositiveInt(args.height, DEFAULT_HEIGHT, 1080);
          const maxColors = normalizePositiveInt(args.maxColors, DEFAULT_MAX_COLORS, 256);
          const maxFrames = normalizePositiveInt(args.maxFrames, 100, 300);
          const captureDelayMs = normalizePositiveInt(args.captureDelayMs, 150, 2000);
          const frameDelayCs = normalizePositiveInt(args.frameDelayCs, 20, 100);

          const startResult = await startAutoCapture(tab.id, {
            width,
            height,
            maxColors,
            maxFrames,
            captureDelayMs,
            frameDelayCs,
            enhancedRendering: args.enhancedRendering,
          });

          if (!startResult.success) {
            return this.buildResponse({
              success: false,
              action: 'auto_start',
              tabId: tab.id,
              error: startResult.error,
            });
          }

          // Store metadata for stop
          gifRecorderState.autoCaptureMetadata = {
            tabId: tab.id,
            filename: args.filename,
          };

          // Capture initial frame
          await captureInitialFrame(tab.id);

          return this.buildResponse({
            success: true,
            action: 'auto_start',
            tabId: tab.id,
            mode: 'auto_capture',
            isRecording: true,
          });
        }

        case 'capture': {
          // Manual frame capture in auto mode
          const tab = await this.resolveGifTargetTab(args.tabId);
          if (!tab?.id) {
            return createErrorResponse(
              typeof args.tabId === 'number'
                ? `Tab not found: ${args.tabId}`
                : 'No active tab found',
            );
          }

          if (!isAutoCaptureActive(tab.id)) {
            return createErrorResponse(
              'Auto-capture is not active for this tab. Use action="auto_start" first.',
            );
          }

          // Support optional annotation for manual captures
          const annotation =
            typeof args.annotation === 'string' && args.annotation.trim().length > 0
              ? args.annotation.trim()
              : undefined;

          const action: ActionMetadata | undefined = annotation
            ? { type: 'annotation', label: annotation }
            : undefined;

          const captureResult = await captureFrameOnAction(tab.id, action, true);

          return this.buildResponse({
            success: captureResult.success,
            action: 'capture',
            tabId: tab.id,
            frameCount: captureResult.frameNumber,
            error: captureResult.error,
          });
        }

        case 'stop': {
          // Stop either mode
          // Check auto-capture first
          const autoTab = gifRecorderState.autoCaptureMetadata?.tabId;
          if (autoTab !== undefined && isAutoCaptureActive(autoTab)) {
            const stopResult = await stopAutoCapture(autoTab);
            const filename = gifRecorderState.autoCaptureMetadata?.filename;
            gifRecorderState.autoCaptureMetadata = null;

            if (!stopResult.success || !stopResult.gifData) {
              return this.buildResponse({
                success: false,
                action: 'stop',
                tabId: autoTab,
                mode: 'auto_capture',
                frameCount: stopResult.frameCount,
                durationMs: stopResult.durationMs,
                actionsCount: stopResult.actions?.length,
                error: stopResult.error || 'No GIF data generated',
              });
            }

            // Cache for later export
            gifRecorderState.lastRecordedGif = {
              gifData: stopResult.gifData,
              width: DEFAULT_WIDTH, // auto mode uses default dimensions
              height: DEFAULT_HEIGHT,
              frameCount: stopResult.frameCount ?? 0,
              durationMs: stopResult.durationMs ?? 0,
              tabId: autoTab,
              filename,
              actionsCount: stopResult.actions?.length,
              mode: 'auto_capture',
              createdAt: Date.now(),
            };

            // Save GIF file
            const blob = new Blob([new Uint8Array(stopResult.gifData)], { type: 'image/gif' });
            const dataUrl = await blobToDataUrl(blob);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFilename =
              filename?.replace(/[^a-z0-9_-]/gi, '_') || `recording_${timestamp}`;
            const fullFilename = outputFilename.endsWith('.gif')
              ? outputFilename
              : `${outputFilename}.gif`;

            const downloadId = await chrome.downloads.download({
              url: dataUrl,
              filename: fullFilename,
              saveAs: false,
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            let fullPath: string | undefined;
            try {
              const [downloadItem] = await chrome.downloads.search({ id: downloadId });
              fullPath = downloadItem?.filename;
            } catch {
              // Ignore
            }

            return this.buildResponse({
              success: true,
              action: 'stop',
              tabId: autoTab,
              mode: 'auto_capture',
              frameCount: stopResult.frameCount,
              durationMs: stopResult.durationMs,
              byteLength: stopResult.gifData.byteLength,
              actionsCount: stopResult.actions?.length,
              downloadId,
              filename: fullFilename,
              fullPath,
            });
          }

          // Fall back to fixed-FPS stop
          const result = await stopRecording();
          if (result.success) {
            result.mode = 'fixed_fps';
          }
          return this.buildResponse(result);
        }

        case 'status': {
          // Check auto-capture status first
          const autoTab = gifRecorderState.autoCaptureMetadata?.tabId;
          if (autoTab !== undefined && isAutoCaptureActive(autoTab)) {
            const status = getAutoCaptureStatus(autoTab);
            return this.buildResponse({
              success: true,
              action: 'status',
              tabId: autoTab,
              isRecording: status.active,
              mode: 'auto_capture',
              frameCount: status.frameCount,
              durationMs: status.durationMs,
              actionsCount: status.actionsCount,
            });
          }

          // Fall back to fixed-FPS status
          const result = getRecordingStatus();
          if (result.isRecording) {
            result.mode = 'fixed_fps';
          }
          return this.buildResponse(result);
        }

        case 'clear': {
          // Clear all recording state and cached GIF
          let clearedAuto = false;
          let clearedFixedFps = false;
          let clearedCache = false;

          // Stop auto-capture if active
          const autoTab = gifRecorderState.autoCaptureMetadata?.tabId;
          if (autoTab !== undefined && isAutoCaptureActive(autoTab)) {
            await stopAutoCapture(autoTab);
            gifRecorderState.autoCaptureMetadata = null;
            clearedAuto = true;
          }

          // Stop fixed-FPS recording if active or stopping
          if (gifRecorderState.recordingState) {
            // Cancel timer and cleanup without waiting for finish
            if (gifRecorderState.recordingState.captureTimer) {
              clearTimeout(gifRecorderState.recordingState.captureTimer);
              gifRecorderState.recordingState.captureTimer = null;
            }
            try {
              await gifRecorderState.recordingState.captureInProgress;
            } catch {
              // ignore
            }
            try {
              await cdpSessionManager.detach(
                gifRecorderState.recordingState.tabId,
                CDP_SESSION_KEY,
              );
            } catch {
              // ignore
            }
            const wasRecording =
              gifRecorderState.recordingState.isRecording ||
              gifRecorderState.recordingState.isStopping;
            gifRecorderState.recordingState = null;
            gifRecorderState.stopPromise = null; // Clear any pending stop promise
            if (wasRecording) {
              clearedFixedFps = true;
            }
          }

          // Reset offscreen encoder
          try {
            await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_RESET, {});
          } catch {
            // ignore
          }

          // Clear cached GIF
          if (gifRecorderState.lastRecordedGif) {
            gifRecorderState.lastRecordedGif = null;
            clearedCache = true;
          }

          return this.buildResponse({
            success: true,
            action: 'clear',
            clearedAutoCapture: clearedAuto,
            clearedFixedFps,
            clearedCache,
          } as GifResult);
        }

        case 'export': {
          // Export the last recorded GIF (download or drag&drop upload)

          // Check if cache is valid
          if (!gifRecorderState.lastRecordedGif) {
            return createErrorResponse(
              'No recorded GIF available for export. Use action="stop" to finish a recording first.',
            );
          }

          // Check cache expiration
          if (Date.now() - gifRecorderState.lastRecordedGif.createdAt > EXPORT_CACHE_LIFETIME_MS) {
            gifRecorderState.lastRecordedGif = null;
            return createErrorResponse('Cached GIF has expired. Please record a new GIF.');
          }

          const download = args.download !== false; // Default to download

          if (download) {
            // Download mode
            const blob = new Blob([new Uint8Array(gifRecorderState.lastRecordedGif.gifData)], {
              type: 'image/gif',
            });
            const dataUrl = await blobToDataUrl(blob);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = args.filename ?? gifRecorderState.lastRecordedGif.filename;
            const outputFilename = filename?.replace(/[^a-z0-9_-]/gi, '_') || `export_${timestamp}`;
            const fullFilename = outputFilename.endsWith('.gif')
              ? outputFilename
              : `${outputFilename}.gif`;

            const downloadId = await chrome.downloads.download({
              url: dataUrl,
              filename: fullFilename,
              saveAs: false,
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            let fullPath: string | undefined;
            try {
              const [downloadItem] = await chrome.downloads.search({ id: downloadId });
              fullPath = downloadItem?.filename;
            } catch {
              // Ignore
            }

            return this.buildResponse({
              success: true,
              action: 'export',
              mode: gifRecorderState.lastRecordedGif.mode,
              frameCount: gifRecorderState.lastRecordedGif.frameCount,
              durationMs: gifRecorderState.lastRecordedGif.durationMs,
              byteLength: gifRecorderState.lastRecordedGif.gifData.byteLength,
              downloadId,
              filename: fullFilename,
              fullPath,
            });
          } else {
            // Drag&drop upload mode
            const { coordinates, ref, selector } = args;

            if (!coordinates && !ref && !selector) {
              return createErrorResponse(
                'For drag&drop upload, provide coordinates, ref, or selector to identify the drop target.',
              );
            }

            // Resolve target tab
            const tab = await this.resolveGifTargetTab(args.tabId);
            if (!tab?.id) {
              return createErrorResponse(
                typeof args.tabId === 'number'
                  ? `Tab not found: ${args.tabId}`
                  : 'No active tab found',
              );
            }

            // Security check
            if (this.isRestrictedUrl(tab.url)) {
              return createErrorResponse(
                'Cannot upload to special browser pages or web store pages.',
              );
            }

            // Prepare GIF data as base64
            const gifBase64 = btoa(
              Array.from(gifRecorderState.lastRecordedGif.gifData)
                .map((b) => String.fromCharCode(b))
                .join(''),
            );

            // Resolve drop target coordinates
            let targetX: number | undefined;
            let targetY: number | undefined;

            if (ref) {
              // Use the project's built-in ref resolution mechanism
              try {
                await this.injectContentScript(tab.id, [
                  'inject-scripts/accessibility-tree-helper.js',
                ]);
                const resolved = await this.sendMessageToTab(tab.id, {
                  action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
                  ref,
                });
                if (resolved?.success && resolved.center) {
                  targetX = resolved.center.x;
                  targetY = resolved.center.y;
                } else {
                  return createErrorResponse(`Could not resolve ref: ${ref}`);
                }
              } catch (err) {
                return createErrorResponse(
                  `Failed to resolve ref: ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            } else if (selector) {
              // Use executeScript to get element center coordinates by CSS selector
              try {
                const [result] = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: (cssSelector: string) => {
                    const el = document.querySelector(cssSelector);
                    if (!el) return null;
                    const rect = el.getBoundingClientRect();
                    return {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2,
                    };
                  },
                  args: [selector],
                });

                if (result?.result) {
                  targetX = result.result.x;
                  targetY = result.result.y;
                } else {
                  return createErrorResponse(`Could not find element: ${selector}`);
                }
              } catch (err) {
                return createErrorResponse(
                  `Failed to resolve selector: ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            } else if (coordinates) {
              targetX = coordinates.x;
              targetY = coordinates.y;
            }

            if (typeof targetX !== 'number' || typeof targetY !== 'number') {
              return createErrorResponse('Invalid drop target coordinates.');
            }

            // Execute drag&drop upload
            try {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename =
                args.filename ??
                gifRecorderState.lastRecordedGif.filename ??
                `recording_${timestamp}`;
              const fullFilename = filename.endsWith('.gif') ? filename : `${filename}.gif`;

              const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (base64Data: string, x: number, y: number, fname: string) => {
                  // Convert base64 to Blob
                  const byteChars = atob(base64Data);
                  const byteArray = new Uint8Array(byteChars.length);
                  for (let i = 0; i < byteChars.length; i++) {
                    byteArray[i] = byteChars.charCodeAt(i);
                  }
                  const blob = new Blob([byteArray], { type: 'image/gif' });
                  const file = new File([blob], fname, { type: 'image/gif' });

                  // Find drop target element
                  const target = document.elementFromPoint(x, y);
                  if (!target) {
                    return { success: false, error: 'No element at drop coordinates' };
                  }

                  // Create DataTransfer with the file
                  const dt = new DataTransfer();
                  dt.items.add(file);

                  // Dispatch drag events
                  const events = ['dragenter', 'dragover', 'drop'] as const;
                  for (const eventType of events) {
                    const evt = new DragEvent(eventType, {
                      bubbles: true,
                      cancelable: true,
                      dataTransfer: dt,
                      clientX: x,
                      clientY: y,
                    });
                    target.dispatchEvent(evt);
                  }

                  return {
                    success: true,
                    targetTagName: target.tagName,
                    targetId: target.id || undefined,
                  };
                },
                args: [gifBase64, targetX, targetY, fullFilename],
              });

              if (!result?.result?.success) {
                return createErrorResponse(result?.result?.error || 'Drag&drop upload failed');
              }

              return this.buildResponse({
                success: true,
                action: 'export',
                mode: gifRecorderState.lastRecordedGif.mode,
                frameCount: gifRecorderState.lastRecordedGif.frameCount,
                durationMs: gifRecorderState.lastRecordedGif.durationMs,
                byteLength: gifRecorderState.lastRecordedGif.gifData.byteLength,
                uploadTarget: {
                  x: targetX,
                  y: targetY,
                  tagName: result.result.targetTagName,
                  id: result.result.targetId,
                },
              } as GifResult);
            } catch (err) {
              return createErrorResponse(
                `Drag&drop upload failed: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }

        default:
          return createErrorResponse(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('GifRecorderTool.execute error:', error);
      return createErrorResponse(
        `GIF recorder error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private isRestrictedUrl(url?: string): boolean {
    if (!url) return false;
    return (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('https://chrome.google.com/webstore') ||
      url.startsWith('https://microsoftedge.microsoft.com/')
    );
  }

  private async resolveGifTargetTab(tabId?: number): Promise<chrome.tabs.Tab | null> {
    if (typeof tabId === 'number') {
      return this.tryGetTab(tabId);
    }
    try {
      return await this.getActiveTabOrThrow();
    } catch {
      return null;
    }
  }

  private buildResponse(result: GifResult): ToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: !result.success,
    };
  }
}

export const gifRecorderTool = new GifRecorderTool();

// Re-export auto-capture utilities for use by other tools (e.g., chrome_computer, chrome_navigate)
export {
  captureFrameOnAction,
  isAutoCaptureActive,
  type ActionMetadata,
  type ActionType,
} from './gif-auto-capture';
