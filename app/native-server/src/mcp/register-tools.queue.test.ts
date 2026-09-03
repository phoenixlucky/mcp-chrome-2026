import { afterEach, describe, expect, test } from '@jest/globals';
import { acquireToolCallSlot, getToolAdmissionStats } from './register-tools.js';

describe('tool admission gates', () => {
  test('rejects a full queue and cancels queued requests', async () => {
    const initial = getToolAdmissionStats();
    expect(initial.active).toBe(0);
    expect(initial.queued).toBe(0);

    const releases = await Promise.all(
      Array.from({ length: initial.maxActive }, () =>
        acquireToolCallSlot(undefined, 'write', 'profile-a'),
      ),
    );
    const controllers = Array.from({ length: initial.maxQueued }, () => new AbortController());
    const queued = controllers.map((controller) =>
      acquireToolCallSlot(controller.signal, 'read', 'profile-b').catch((error) => error),
    );
    await expect(acquireToolCallSlot(undefined, 'write', 'profile-c')).rejects.toMatchObject({
      code: 'QUEUE_FULL',
    });

    expect(getToolAdmissionStats()).toMatchObject({
      active: initial.maxActive,
      queued: initial.maxQueued,
      byProfile: {
        'profile-a': { active: initial.maxActive, queued: 0 },
        'profile-b': { active: 0, queued: initial.maxQueued },
      },
    });
    controllers.forEach((controller) => controller.abort());
    await Promise.all(queued);
    releases.forEach((release) => release());

    const final = getToolAdmissionStats();
    expect(final.active).toBe(0);
    expect(final.queued).toBe(0);
    expect(final.rejected).toBeGreaterThanOrEqual(1);
    expect(final.cancelled).toBeGreaterThanOrEqual(initial.maxQueued);
  });

  test('keeps reads and writes isolated by profile while respecting the global cap', async () => {
    const stats = getToolAdmissionStats();
    expect(stats.active).toBe(0);
    const releases = await Promise.all([
      acquireToolCallSlot(undefined, 'read', 'profile-read'),
      acquireToolCallSlot(undefined, 'write', 'profile-write'),
    ]);
    expect(getToolAdmissionStats().byProfile).toEqual({
      'profile-read': { active: 1, queued: 0 },
      'profile-write': { active: 1, queued: 0 },
    });
    releases.forEach((release) => release());
    expect(getToolAdmissionStats().active).toBe(0);
  });
});

afterEach(() => {
  expect(getToolAdmissionStats().active).toBe(0);
  expect(getToolAdmissionStats().queued).toBe(0);
});
