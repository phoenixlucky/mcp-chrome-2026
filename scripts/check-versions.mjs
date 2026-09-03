#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageFiles = [
  'package.json',
  'app/chrome-extension/package.json',
  'app/native-server/package.json',
  'app/desktop-client/package.json',
  'packages/shared/package.json',
  'packages/wasm-simd/package.json',
];

const versions = packageFiles.map((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return { relativePath, version: packageJson.version };
});

const cargoPath = path.join(root, 'packages/wasm-simd/Cargo.toml');
const cargo = fs.readFileSync(cargoPath, 'utf8');
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
versions.push({ relativePath: 'packages/wasm-simd/Cargo.toml', version: cargoVersion });

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
const expected = versions[0]?.version;
const mismatched = versions.filter((item) => item.version !== expected);
if (missing.length > 0 || mismatched.length > 0) {
  console.error('Project version mismatch:');
  for (const item of versions) console.error(`- ${item.relativePath}: ${item.version || '(missing)'}`);
  process.exit(1);
}

console.log(`Project versions are aligned at ${expected}.`);
