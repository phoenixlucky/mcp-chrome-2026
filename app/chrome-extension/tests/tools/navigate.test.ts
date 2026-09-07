import { describe, expect, it } from 'vitest';
import { getNavigationWaitOptions } from '@/entrypoints/background/tools/browser/common';

describe('chrome_navigate readiness policy', () => {
  it('returns after navigation is accepted by default', () => {
    expect(getNavigationWaitOptions({})).toMatchObject({
      waitForReady: false,
      waitTimeoutMs: 15_000,
    });
  });

  it('still supports an explicit bounded complete-state wait', () => {
    expect(getNavigationWaitOptions({ waitForReady: true, waitTimeoutMs: 45_000 })).toEqual({
      waitForReady: true,
      waitTimeoutMs: 30_000,
    });
  });
});
