import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPortableFooter, PORTABLE_FOOTER_LENGTH, PORTABLE_FOOTER_MAGIC } from './portable-launcher-format.mjs';

test('portable footer stores bundle length and SHA-256 after the magic', () => {
  const bundle = Buffer.from('portable bundle fixture');
  const footer = createPortableFooter(bundle);

  assert.equal(footer.length, PORTABLE_FOOTER_LENGTH);
  assert.deepEqual(footer.subarray(0, 8), PORTABLE_FOOTER_MAGIC);
  assert.equal(footer.readBigUInt64LE(8), BigInt(bundle.length));
  assert.equal(footer.subarray(16).toString('ascii'), createHash('sha256').update(bundle).digest('hex'));
});
