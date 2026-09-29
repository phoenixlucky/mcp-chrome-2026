import { describe, expect, it } from 'vitest';
import { normalizePositiveInt } from '@/entrypoints/background/tools/browser/gif-recording-session';

describe('normalizePositiveInt', () => {
  it('uses the fallback for non-positive or non-integer input', () => {
    expect(normalizePositiveInt(0, 5)).toBe(1);
    expect(normalizePositiveInt(2.5, 5)).toBe(2);
    expect(normalizePositiveInt('8', 5)).toBe(5);
  });

  it('caps valid integer input when a maximum is supplied', () => {
    expect(normalizePositiveInt(50, 5, 20)).toBe(20);
    expect(normalizePositiveInt(8, 5, 20)).toBe(8);
  });
});
