import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkExtensionPackage, REQUIRED_EXTENSION_FILES } from './check-extension-package.mjs';

function createStoredZip(entries) {
  const files = entries.map((name) => Buffer.from(name));
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const name of files) {
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localRecords.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralRecords.push(central);
    localOffset += local.length;
    centralSize += central.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localRecords, ...centralRecords, end]);
}

async function createPackageFixture(t, { entries = REQUIRED_EXTENSION_FILES, zipSize } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'chrome-extension-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const zipPath = join(root, 'extension.zip');
  const archive = createStoredZip(entries);
  await writeFile(zipPath, zipSize === undefined ? archive : Buffer.alloc(zipSize));
  return { zipPath };
}

test('accepts a WASM-only package under the configured size limit', async (t) => {
  const fixture = await createPackageFixture(t);
  const result = await checkExtensionPackage(fixture);
  assert.equal(result.zipSizeBytes > 0, true);
});

test('rejects ZIP archives that still include JSEP assets', async (t) => {
  const fixture = await createPackageFixture(t, {
    entries: [...REQUIRED_EXTENSION_FILES, 'workers/ort-wasm-simd-threaded.jsep.wasm'],
  });
  await assert.rejects(checkExtensionPackage(fixture), /JSEP assets are not supported/);
});

test('rejects packages over the maximum size', async (t) => {
  const fixture = await createPackageFixture(t, { zipSize: 6_600_001 });
  await assert.rejects(checkExtensionPackage(fixture), /exceeds 6600000 bytes/);
});

test('rejects ZIP archives missing required WASM runtime files', async (t) => {
  const fixture = await createPackageFixture(t, {
    entries: REQUIRED_EXTENSION_FILES.filter(
      (file) => file !== 'workers/ort-wasm-simd-threaded.wasm',
    ),
  });
  await assert.rejects(checkExtensionPackage(fixture), /Missing required package files/);
});
