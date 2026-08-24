export type ActionPolicyMode = 'fast' | 'balanced' | 'human';

export interface ActionPolicy {
  mode: ActionPolicyMode;
  beforeMs: number;
  afterMs: number;
}

const ACTION_NAMES =
  /(?:navigate|click|fill|scroll|keyboard|computer|upload|paste|dialog|proxy_rotate|select_all_items)/;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    function onAbort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Tool call cancelled'));
    }
    const finish = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    if (!signal) return;
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function resolveActionPolicy(name: string, args: Record<string, unknown>): ActionPolicy {
  if (!ACTION_NAMES.test(name)) return { mode: 'fast', beforeMs: 0, afterMs: 0 };
  const requested = args.actionPolicy;
  const mode: ActionPolicyMode =
    requested === 'fast' || requested === 'human' || requested === 'balanced'
      ? requested
      : 'balanced';
  if (mode === 'fast') return { mode, beforeMs: 0, afterMs: 0 };
  if (mode === 'human') return { mode, beforeMs: 80, afterMs: 260 };
  return { mode, beforeMs: 20, afterMs: 120 };
}

export async function runWithActionPolicy<T>(
  policy: ActionPolicy,
  signal: AbortSignal | undefined,
  action: () => Promise<T>,
): Promise<T> {
  await wait(policy.beforeMs, signal);
  try {
    return await action();
  } finally {
    if (!signal?.aborted) await wait(policy.afterMs, signal);
  }
}
