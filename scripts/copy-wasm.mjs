import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = ['simd_math.js', 'simd_math_bg.wasm'];
const sourceDir = resolve(root, 'packages/wasm-simd/pkg');
const missingFiles = files.filter((file) => !existsSync(resolve(sourceDir, file)));

if (missingFiles.length > 0) {
  throw new Error(
    `Missing WASM artifacts: ${missingFiles.join(', ')}. Run ` +
      '`pnpm run build:wasm` before copying them.',
  );
}

for (const file of files) {
  const source = resolve(sourceDir, file);
  const target = resolve(root, 'app/chrome-extension/workers', file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
