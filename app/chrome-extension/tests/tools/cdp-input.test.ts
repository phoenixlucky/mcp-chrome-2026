import { describe, expect, it } from 'vitest';
import { CDPHelper } from '@/entrypoints/background/tools/browser/cdp-input';

describe('CDPHelper keyboard input', () => {
  it('maps modifier aliases to Chrome DevTools modifier bits', () => {
    expect(CDPHelper.modifierMask(['ctrl', 'shift', 'cmd'])).toBe(14);
    expect(CDPHelper.modifierMask(['unknown'])).toBe(0);
  });

  it('resolves named keys, function keys, and printable characters', () => {
    expect(CDPHelper.resolveKeyDefinition('enter')).toEqual({ key: 'Enter', code: 'Enter' });
    expect(CDPHelper.resolveKeyDefinition('f12')).toEqual({ key: 'F12', code: 'F12' });
    expect(CDPHelper.resolveKeyDefinition('a')).toEqual({ key: 'A', code: 'KeyA', text: 'a' });
    expect(CDPHelper.resolveKeyDefinition('Custom')).toEqual({ key: 'Custom' });
  });
});
