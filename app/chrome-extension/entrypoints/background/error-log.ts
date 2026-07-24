import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

const ERROR_LOG_KEY = 'pluginErrorLogs';
const MAX_ERROR_LOGS = 200;

export interface PluginErrorLog {
  timestamp: string;
  type: 'console.error' | 'uncaught' | 'unhandledrejection';
  message: string;
  stack?: string;
}

let initialized = false;
let writeQueue = Promise.resolve();

export function formatErrorLogArguments(
  args: unknown[],
): Pick<PluginErrorLog, 'message' | 'stack'> {
  const error = args.find((arg): arg is Error => arg instanceof Error);
  return {
    message: args
      .map((arg) =>
        arg instanceof Error ? arg.message : typeof arg === 'string' ? arg : String(arg),
      )
      .join(' '),
    stack: error?.stack,
  };
}

function record(type: PluginErrorLog['type'], args: unknown[]): void {
  const entry: PluginErrorLog = {
    timestamp: new Date().toISOString(),
    type,
    ...formatErrorLogArguments(args),
  };
  writeQueue = writeQueue
    .then(async () => {
      const stored = await chrome.storage.local.get(ERROR_LOG_KEY);
      const logs = Array.isArray(stored[ERROR_LOG_KEY]) ? stored[ERROR_LOG_KEY] : [];
      await chrome.storage.local.set({ [ERROR_LOG_KEY]: [...logs, entry].slice(-MAX_ERROR_LOGS) });
    })
    .catch(() => {});
}

export async function readPluginErrorLogs(): Promise<PluginErrorLog[]> {
  await writeQueue;
  const stored = await chrome.storage.local.get(ERROR_LOG_KEY);
  return Array.isArray(stored[ERROR_LOG_KEY]) ? stored[ERROR_LOG_KEY] : [];
}

async function clearPluginErrorLogs(): Promise<void> {
  await writeQueue;
  await chrome.storage.local.remove(ERROR_LOG_KEY);
}

export function initErrorLog(): void {
  if (initialized) return;
  initialized = true;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    record('console.error', args);
  };
  self.addEventListener('error', (event) => record('uncaught', [event.message, event.error]));
  self.addEventListener('unhandledrejection', (event) =>
    record('unhandledrejection', [event.reason]),
  );
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === BACKGROUND_MESSAGE_TYPES.GET_ERROR_LOGS) {
      readPluginErrorLogs().then((logs) => sendResponse({ success: true, logs }));
    } else if (message?.type === BACKGROUND_MESSAGE_TYPES.CLEAR_ERROR_LOGS) {
      clearPluginErrorLogs().then(() => sendResponse({ success: true }));
    } else {
      return;
    }
    return true;
  });
}
