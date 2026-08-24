import { describe, expect, test } from 'vitest';
import { resolveActionPolicy } from '../../entrypoints/background/tools/action-policy';

describe('ActionPolicy', () => {
  test('uses stable pacing by default and allows an explicit fast mode', () => {
    expect(resolveActionPolicy('chrome_click_element', {}).mode).toBe('balanced');
    expect(resolveActionPolicy('chrome_click_element', {}).afterMs).toBeGreaterThan(0);
    expect(resolveActionPolicy('chrome_click_element', { actionPolicy: 'fast' })).toEqual({
      mode: 'fast',
      beforeMs: 0,
      afterMs: 0,
    });
    expect(resolveActionPolicy('chrome_get_page_text', {}).afterMs).toBe(0);
  });
});
