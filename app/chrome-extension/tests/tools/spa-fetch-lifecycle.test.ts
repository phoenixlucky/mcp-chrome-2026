import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pauseSpaFetchTabCleanup,
  scheduleSpaFetchTabCleanup,
} from '@/entrypoints/background/tools/browser/spa-fetch';

const chromeApi = globalThis.chrome as any;

describe('SPA fetch temporary tab cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeApi.tabs.get.mockResolvedValue({ id: 42 });
    chromeApi.alarms.get.mockResolvedValue(undefined);
    chromeApi.alarms.create.mockResolvedValue(undefined);
    chromeApi.alarms.clear.mockResolvedValue(true);
  });

  it('schedules an idle cleanup alarm for a created tab', async () => {
    await scheduleSpaFetchTabCleanup(42);

    expect(chromeApi.alarms.create).toHaveBeenCalledWith('chrome-spa-fetch-idle:42', {
      delayInMinutes: 2,
    });
  });

  it('pauses cleanup when a temporary tab is used again', async () => {
    chromeApi.alarms.get.mockResolvedValue({ name: 'chrome-spa-fetch-idle:42' });

    await expect(pauseSpaFetchTabCleanup(42)).resolves.toBe(true);
    expect(chromeApi.alarms.clear).toHaveBeenCalledWith('chrome-spa-fetch-idle:42');
  });
});
