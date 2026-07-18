import { TOOL_NAMES } from '@ethanwilkins/chrome-mcp-shared-2026';
import { handleCallTool } from '@/entrypoints/background/tools';

export async function waitForNetworkIdle(totalTimeoutMs: number, idleThresholdMs: number) {
  const deadline = Date.now() + Math.max(500, totalTimeoutMs);
  const threshold = Math.max(200, idleThresholdMs);
  while (Date.now() < deadline) {
    await handleCallTool({
      name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE_START,
      args: { includeStatic: false, maxCaptureTime: Math.min(60_000, Math.max(threshold + 500, 2_000)), inactivityTimeout: 0 },
    });
    await new Promise((resolve) => setTimeout(resolve, threshold + 200));
    const result = await handleCallTool({ name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE_STOP, args: {} });
    const text = (result as { content?: Array<{ type?: string; text?: string }> }).content?.find((item) => item.type === 'text')?.text;
    try {
      const payload = text ? JSON.parse(text) : null;
      const end = Number(payload?.captureEndTime) || Date.now();
      const last = (Array.isArray(payload?.requests) ? payload.requests : []).reduce(
        (latest: number, request: { responseTime?: number; requestTime?: number }) => Math.max(latest, Number(request.responseTime || request.requestTime || 0)),
        Number(payload?.captureStartTime || 0),
      );
      if (end - last >= threshold) return;
    } catch { /* retry until timeout */ }
  }
  throw new Error('wait for network idle timed out');
}

export async function waitForNavigation(timeoutMs = 15_000, previousUrl = ''): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id !== 'number') throw new Error('Active tab not found');
  await new Promise<void>((resolve, reject) => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); chrome.tabs.onUpdated.removeListener(onUpdated); resolve(); } };
    const onUpdated = (tabId: number, change: chrome.tabs.TabChangeInfo) => {
      if (tabId === tab.id && (change.status === 'complete' || (typeof change.url === 'string' && change.url !== previousUrl))) finish();
    };
    const timer = setTimeout(() => { if (!done) { chrome.tabs.onUpdated.removeListener(onUpdated); reject(new Error('navigation timeout')); } }, Math.max(1_000, Math.min(timeoutMs, 30_000)));
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}
