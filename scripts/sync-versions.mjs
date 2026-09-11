#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackagePath = path.join(root, 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
const version = rootPackage.version;

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid product version in package.json: ${version}`);
}

const changed = [];

function replaceFile(relativePath, pattern, replacement) {
  const filePath = path.join(root, relativePath);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = before.replace(pattern, replacement);
  if (before === after) return;
  fs.writeFileSync(filePath, after, 'utf8');
  changed.push(relativePath);
}

replaceFile(
  'app/desktop-client/src-tauri/Cargo.toml',
  /^(version\s*=\s*")[^"]+("\s*)$/m,
  `$1${version}$2`,
);

const tauriConfigPath = path.join(root, 'app/desktop-client/src-tauri/tauri.conf.json');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
if (tauriConfig.version !== version) {
  tauriConfig.version = version;
  fs.writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`, 'utf8');
  changed.push('app/desktop-client/src-tauri/tauri.conf.json');
}

if (changed.length === 0) {
  console.log(`Product versions are already aligned at ${version}.`);
} else {
  console.log(`Synced product version ${version} to:`);
  for (const file of changed) console.log(`- ${file}`);
}
