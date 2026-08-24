import { afterEach, describe, expect, it } from 'vitest';

import { createPerfMonitor } from '@/entrypoints/web-editor-v3/core/perf-monitor';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('perf monitor scroll coordinates', () => {
  it('shows the current page position only while enabled', () => {
    Object.defineProperties(window, {
      scrollX: { configurable: true, value: 24 },
      scrollY: { configurable: true, value: 640 },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const monitor = createPerfMonitor({ container });

    monitor.setScrollCoordinatesVisible(true);
    expect(container.querySelector<HTMLElement>('.we-perf-hud')?.hidden).toBe(false);
    expect(container.querySelector('.we-perf-hud-line:last-child')?.textContent).toBe(
      'Scroll: X 24, Y 640',
    );

    monitor.setScrollCoordinatesVisible(false);
    expect(container.querySelector<HTMLElement>('.we-perf-hud')?.hidden).toBe(true);
    monitor.dispose();
  });
});
