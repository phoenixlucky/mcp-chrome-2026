import { describe, expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { isExactVersion, verifyIntegrity } from './safe-upgrade.js';

describe('safe upgrade guards', () => {
  test('requires an exact version and verifies npm sha512 integrity', () => {
    const data = Buffer.from('chrome-mcp');
    const digest = createHash('sha512').update(data).digest('base64');

    expect(isExactVersion('2.2.2')).toBe(true);
    expect(isExactVersion('latest')).toBe(false);
    expect(verifyIntegrity(data, `sha512-${digest}`)).toBe(true);
    expect(verifyIntegrity(Buffer.from('tampered'), `sha512-${digest}`)).toBe(false);
  });
});
