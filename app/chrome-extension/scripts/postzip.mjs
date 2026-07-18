import { readdirSync, statSync, cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..', '..');
const releasesDir = join(rootDir, 'releases');

// Copy extension zip
const dir = join('.output');
const zips = readdirSync(dir)
  .filter(x => x.endsWith('.zip'))
  .map(f => ({ name: f, time: statSync(join(dir, f)).mtime }))
  .sort((a, b) => b.time - a.time);

if (zips[0]) {
  cpSync(join(dir, zips[0].name), join(releasesDir, zips[0].name), { force: true });
  console.log('📦 Released: releases/' + zips[0].name);
}

const version = zips[0]?.name.replace(/^chrome-mcp-server-|(-chrome)?\.zip$/g, '') || 'unknown';

// Copy startup scripts alongside the zip
const startupFiles = [
  'start-server.bat',
  'start-server-npm.bat',
];

for (const f of startupFiles) {
  const src = join(rootDir, f);
  const dst = join(releasesDir, f.replace('.bat', `-${version}.bat`));
  try {
    cpSync(src, dst, { force: true });
    console.log(`📄 Copied: releases/${f.replace('.bat', `-${version}.bat`)}`);
  } catch (e) {
    console.warn(`⚠️  Could not copy ${f}: ${e.message}`);
  }
}
