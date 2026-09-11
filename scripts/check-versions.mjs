#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const expected = rootPackage.version;
const versions = [];

const desktopCargoPath = path.join(root, 'app/desktop-client/src-tauri/Cargo.toml');
const desktopCargo = fs.readFileSync(desktopCargoPath, 'utf8');
const desktopCargoVersion = desktopCargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
versions.push({
  relativePath: 'app/desktop-client/src-tauri/Cargo.toml',
  version: desktopCargoVersion,
});

const tauriConfigPath = path.join(root, 'app/desktop-client/src-tauri/tauri.conf.json');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
versions.push({
  relativePath: 'app/desktop-client/src-tauri/tauri.conf.json',
  version: tauriConfig.version,
});

const missing = versions.filter((item) => !item.version);
const mismatched = versions.filter((item) => item.version !== expected);
if (missing.length > 0 || mismatched.length > 0) {
  console.error('Project version mismatch:');
  for (const item of versions) console.error(`- ${item.relativePath}: ${item.version || '(missing)'}`);
  process.exit(1);
}

console.log(`Product versions are aligned at ${expected}.`);
