import { describe, expect, it } from 'vitest';
import {
  buildScrollContainerExpression,
  getPixelScrollPlan,
} from '@/entrypoints/background/tools/browser/scroll-expressions';

describe('scroll expression helpers', () => {
  it('keeps fast pixel scrolls to one immediate step by default', () => {
    expect(getPixelScrollPlan({ amount: 240, direction: 'left' })).toEqual({
      deltaX: -240,
      deltaY: 0,
      steps: 1,
      intervalMs: 0,
    });
  });

  it('serializes selectors into the generated page expression', () => {
    const expression = buildScrollContainerExpression('#feed\\"quoted');
    expect(expression).toContain(`doc.querySelector(${JSON.stringify('#feed\\"quoted')})`);
  });
});
