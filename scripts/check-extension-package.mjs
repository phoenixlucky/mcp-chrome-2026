import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_EXTENSION_ZIP_BYTES = 6_600_000;

export const REQUIRED_EXTENSION_FILES = [
  'libs/ort.min.js',
  'workers/similarity.worker.js',
  'workers/ort-wasm-simd-threaded.mjs',
  'workers/ort-wasm-simd-threaded.wasm',
  'workers/simd_math.js',
  'workers/simd_math_bg.wasm',
];

function readZipEntryNames(archive) {
  const minOffset = Math.max(0, archive.length - 22 - 0xffff);
  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= minOffset; offset--) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error('Extension archive is not a valid ZIP file');

  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  if (entryCount === 0xffff || offset === 0xffffffff) {
    throw new Error('ZIP64 extension archives are not supported by the package checker');
  }

  const names = [];
  for (let index = 0; index < entryCount; index++) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Extension archive contains an invalid ZIP directory');
    }
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    names.push(archive.subarray(fileNameStart, fileNameStart + fileNameLength).toString('utf8'));
    offset = fileNameStart + fileNameLength + extraLength + commentLength;
  }
  return names;
}

export async function checkExtensionPackage({ zipPath, maxZipBytes = MAX_EXTENSION_ZIP_BYTES }) {
  const { size: zipSizeBytes } = await stat(zipPath);
  if (zipSizeBytes > maxZipBytes) {
    throw new Error(
      `Extension ZIP size ${zipSizeBytes} exceeds ${maxZipBytes} bytes (${(zipSizeBytes / 1_000_000).toFixed(2)} MB)`,
    );
  }

  const files = readZipEntryNames(await readFile(zipPath));
  const fileSet = new Set(files);
  const missingFiles = REQUIRED_EXTENSION_FILES.filter((file) => !fileSet.has(file));
  if (missingFiles.length > 0) {
    throw new Error(`Missing required package files: ${missingFiles.join(', ')}`);
  }

  const jsepFiles = files.filter((file) => file.includes('.jsep.'));
  if (jsepFiles.length > 0) {
    throw new Error(`JSEP assets are not supported in this package: ${jsepFiles.join(', ')}`);
  }

  return { zipSizeBytes, files };
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outputDir = join(root, 'app/chrome-extension/.output');
  const archivePaths = (await readdir(outputDir))
    .filter((name) => name.endsWith('.zip'))
    .map((name) => join(outputDir, name));
  if (archivePaths.length === 0) {
    throw new Error(
      'No extension ZIP found. Run `pnpm --filter @ethanwilkins/chrome-mcp-server-2026 zip` first.',
    );
  }
  const archives = await Promise.all(
    archivePaths.map(async (path) => ({ path, modifiedAt: (await stat(path)).mtimeMs })),
  );
  const zipPath = archives.sort((a, b) => b.modifiedAt - a.modifiedAt)[0].path;
  const result = await checkExtensionPackage({ zipPath });
  console.log(
    `Extension package verified: ${(result.zipSizeBytes / 1_000_000).toFixed(2)} MB; required WASM assets present; JSEP assets absent.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
