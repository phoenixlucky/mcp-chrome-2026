import { createHash } from 'node:crypto';

export const PORTABLE_FOOTER_MAGIC = Buffer.from('MCPBRDG1', 'ascii');
export const PORTABLE_FOOTER_LENGTH = 80;

export function createPortableFooter(bundle) {
  const bytes = Buffer.isBuffer(bundle) ? bundle : Buffer.from(bundle);
  const footer = Buffer.alloc(PORTABLE_FOOTER_LENGTH);
  PORTABLE_FOOTER_MAGIC.copy(footer, 0);
  footer.writeBigUInt64LE(BigInt(bytes.length), 8);
  footer.write(createHash('sha256').update(bytes).digest('hex'), 16, 64, 'ascii');
  return footer;
}
