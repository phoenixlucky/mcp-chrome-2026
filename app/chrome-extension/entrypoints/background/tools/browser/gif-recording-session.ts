import {
  MessageTarget,
  OFFSCREEN_MESSAGE_TYPES,
  type OffscreenMessageType,
} from '@/common/message-types';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { offscreenManager } from '@/utils/offscreen-manager';

type GifRecorderAction =
  'start' | 'stop' | 'status' | 'auto_start' | 'capture' | 'clear' | 'export';

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

interface AutoCaptureMetadata {
  tabId: number;
  filename?: string;
}

interface ExportableGif {
  gifData: Uint8Array;
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  tabId: number;
  filename?: string;
  actionsCount?: number;
  mode: 'fixed_fps' | 'auto_capture';
  createdAt: number;
}

export const CDP_SESSION_KEY = 'gif-recorder';
export const EXPORT_CACHE_LIFETIME_MS = 5 * 60 * 1000;

export const gifRecorderState: {
  recordingState: RecordingState | null;
  stopPromise: Promise<GifResult> | null;
  autoCaptureMetadata: AutoCaptureMetadata | null;
  lastRecordedGif: ExportableGif | null;
} = {
  recordingState: null,
  stopPromise: null,
  autoCaptureMetadata: null,
  lastRecordedGif: null,
};

// ============================================================================
// Recording State Management
// ============================================================================

// Auto-capture mode state

// Last recorded GIF cache for export

// Maximum cache lifetime for exportable GIF (5 minutes)

// ============================================================================
// Offscreen Document Communication
// ============================================================================

type OffscreenResponseBase = { success: boolean; error?: string };

export async function sendToOffscreen<TResponse extends OffscreenResponseBase>(
  type: OffscreenMessageType,
  payload: Record<string, unknown> = {},
): Promise<TResponse> {
  await offscreenManager.ensureOffscreenDocument();

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = (await chrome.runtime.sendMessage({
        target: MessageTarget.Offscreen,
        type,
        ...payload,
      })) as TResponse | undefined;

      if (!response) {
        throw new Error('No response received from offscreen document');
      }
      if (!response.success) {
        throw new Error(response.error || 'Unknown offscreen error');
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ============================================================================
// Frame Capture
// ============================================================================

async function captureFrame(
  tabId: number,
  width: number,
  height: number,
  ctx: OffscreenCanvasRenderingContext2D,
): Promise<Uint8ClampedArray> {
  // Get viewport metrics
  const metrics: { layoutViewport?: { clientWidth: number; clientHeight: number } } =
    await cdpSessionManager.sendCommand(tabId, 'Page.getLayoutMetrics', {});

  const viewportWidth = metrics.layoutViewport?.clientWidth || width;
  const viewportHeight = metrics.layoutViewport?.clientHeight || height;

  // Capture screenshot
  const screenshot: { data: string } = await cdpSessionManager.sendCommand(
    tabId,
    'Page.captureScreenshot',
    {
      format: 'png',
      clip: {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: viewportHeight,
        scale: 1,
      },
    },
  );

  const imageBitmap = await createImageBitmapFromUrl(`data:image/png;base64,${screenshot.data}`);

  // Scale image to target dimensions
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  return imageData.data;
}

async function captureAndEncodeFrame(state: RecordingState): Promise<void> {
  const frameData = await captureFrame(state.tabId, state.width, state.height, state.ctx);

  await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME, {
    imageData: Array.from(frameData),
    width: state.width,
    height: state.height,
    delay: state.frameDelayCs,
    maxColors: state.maxColors,
  });

  if (gifRecorderState.recordingState === state && state.isRecording && !state.isStopping) {
    state.frameCount += 1;
  }
}

async function captureTick(state: RecordingState): Promise<void> {
  if (gifRecorderState.recordingState !== state || !state.isRecording || state.isStopping) {
    return;
  }

  const elapsed = Date.now() - state.startTime;
  if (elapsed >= state.durationMs || state.frameCount >= state.maxFrames) {
    await stopRecording();
    return;
  }

  const startedAt = Date.now();
  state.captureInProgress = captureAndEncodeFrame(state);

  try {
    await state.captureInProgress;
  } catch (error) {
    console.error('Frame capture error:', error);
  } finally {
    if (gifRecorderState.recordingState === state) {
      state.captureInProgress = null;
    }
  }

  if (gifRecorderState.recordingState !== state || !state.isRecording || state.isStopping) {
    return;
  }

  const elapsedAfter = Date.now() - state.startTime;
  if (elapsedAfter >= state.durationMs || state.frameCount >= state.maxFrames) {
    await stopRecording();
    return;
  }

  const delayMs = Math.max(0, state.frameIntervalMs - (Date.now() - startedAt));
  state.captureTimer = setTimeout(() => {
    void captureTick(state).catch((error) => {
      console.error('GIF recorder tick error:', error);
    });
  }, delayMs);
}

// ============================================================================
// Recording Control
// ============================================================================

export async function startRecording(
  tabId: number,
  fps: number,
  durationMs: number,
  maxFrames: number,
  width: number,
  height: number,
  maxColors: number,
  filename?: string,
): Promise<GifResult> {
  if (
    gifRecorderState.stopPromise ||
    gifRecorderState.recordingState?.isRecording ||
    gifRecorderState.recordingState?.isStopping
  ) {
    return {
      success: false,
      action: 'start',
      error: 'Recording already in progress',
    };
  }

  try {
    await cdpSessionManager.attach(tabId, CDP_SESSION_KEY);
  } catch (error) {
    return {
      success: false,
      action: 'start',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_RESET, {});

    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas not available in this context');
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const frameIntervalMs = Math.round(1000 / fps);
    const frameDelayCs = Math.max(1, Math.round(100 / fps));

    const state: RecordingState = {
      isRecording: true,
      isStopping: false,
      tabId,
      width,
      height,
      fps,
      durationMs,
      frameIntervalMs,
      frameDelayCs,
      maxFrames,
      maxColors,
      frameCount: 0,
      startTime: Date.now(),
      captureTimer: null,
      captureInProgress: null,
      canvas,
      ctx,
      filename,
    };

    gifRecorderState.recordingState = state;

    // Capture first frame eagerly so start() fails fast if capture/encoding is broken
    await captureAndEncodeFrame(state);

    state.captureTimer = setTimeout(() => {
      void captureTick(state).catch((error) => {
        console.error('GIF recorder tick error:', error);
      });
    }, frameIntervalMs);

    return {
      success: true,
      action: 'start',
      tabId,
      isRecording: true,
    };
  } catch (error) {
    gifRecorderState.recordingState = null;
    try {
      await cdpSessionManager.detach(tabId, CDP_SESSION_KEY);
    } catch {
      // ignore
    }
    return {
      success: false,
      action: 'start',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function stopRecording(): Promise<GifResult> {
  if (gifRecorderState.stopPromise) {
    return gifRecorderState.stopPromise;
  }

  if (
    !gifRecorderState.recordingState ||
    (!gifRecorderState.recordingState.isRecording && !gifRecorderState.recordingState.isStopping)
  ) {
    return {
      success: false,
      action: 'stop',
      error: 'No recording in progress',
    };
  }

  gifRecorderState.stopPromise = (async () => {
    const state = gifRecorderState.recordingState!;
    const tabId = state.tabId;

    // Stop capture timer
    if (state.captureTimer) {
      clearTimeout(state.captureTimer);
      state.captureTimer = null;
    }

    state.isStopping = true;
    state.isRecording = false;

    try {
      await state.captureInProgress;
    } catch {
      // ignore
    }

    // Best-effort final frame capture to preserve end state
    try {
      const frameData = await captureFrame(state.tabId, state.width, state.height, state.ctx);
      await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME, {
        imageData: Array.from(frameData),
        width: state.width,
        height: state.height,
        delay: state.frameDelayCs,
        maxColors: state.maxColors,
      });
      state.frameCount += 1;
    } catch (error) {
      console.warn('GIF recorder: Final frame capture error (non-fatal):', error);
    }

    const frameCount = state.frameCount;
    const durationMs = Date.now() - state.startTime;
    const filename = state.filename;

    try {
      if (frameCount <= 0) {
        try {
          await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_RESET, {});
        } catch {
          // ignore
        }
        return {
          success: false,
          action: 'stop' as const,
          tabId,
          frameCount,
          durationMs,
          error: 'No frames captured',
        };
      }

      const response = await sendToOffscreen<{
        success: boolean;
        gifData?: number[];
        byteLength?: number;
      }>(OFFSCREEN_MESSAGE_TYPES.GIF_FINISH, {});

      if (!response.gifData || response.gifData.length === 0) {
        return {
          success: false,
          action: 'stop' as const,
          tabId,
          frameCount,
          durationMs,
          error: 'No frames captured',
        };
      }

      // Convert to Uint8Array and create blob
      const gifBytes = new Uint8Array(response.gifData);

      // Cache for later export
      gifRecorderState.lastRecordedGif = {
        gifData: gifBytes,
        width: state.width,
        height: state.height,
        frameCount,
        durationMs,
        tabId,
        filename,
        mode: 'fixed_fps',
        createdAt: Date.now(),
      };

      const blob = new Blob([gifBytes], { type: 'image/gif' });
      const dataUrl = await blobToDataUrl(blob);

      // Save GIF file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFilename = filename?.replace(/[^a-z0-9_-]/gi, '_') || `recording_${timestamp}`;
      const fullFilename = outputFilename.endsWith('.gif')
        ? outputFilename
        : `${outputFilename}.gif`;

      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: fullFilename,
        saveAs: false,
      });

      // Wait briefly to get download info
      await new Promise((resolve) => setTimeout(resolve, 100));

      let fullPath: string | undefined;
      try {
        const [downloadItem] = await chrome.downloads.search({ id: downloadId });
        fullPath = downloadItem?.filename;
      } catch {
        // Ignore path lookup errors
      }

      return {
        success: true,
        action: 'stop' as const,
        tabId,
        frameCount,
        durationMs,
        byteLength: response.byteLength ?? gifBytes.byteLength,
        downloadId,
        filename: fullFilename,
        fullPath,
      };
    } catch (error) {
      return {
        success: false,
        action: 'stop' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      try {
        await cdpSessionManager.detach(tabId, CDP_SESSION_KEY);
      } catch {
        // ignore
      }
      gifRecorderState.recordingState = null;
    }
  })();

  return await gifRecorderState.stopPromise.finally(() => {
    gifRecorderState.stopPromise = null;
  });
}

export function getRecordingStatus(): GifResult {
  if (!gifRecorderState.recordingState) {
    return {
      success: true,
      action: 'status',
      isRecording: false,
    };
  }

  return {
    success: true,
    action: 'status',
    isRecording: gifRecorderState.recordingState.isRecording,
    tabId: gifRecorderState.recordingState.tabId,
    frameCount: gifRecorderState.recordingState.frameCount,
    durationMs: Date.now() - gifRecorderState.recordingState.startTime,
  };
}

// ============================================================================
// Utilities
// ============================================================================

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export function normalizePositiveInt(value: unknown, fallback: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const result = Math.max(1, Math.floor(value));
  return max !== undefined ? Math.min(result, max) : result;
}
