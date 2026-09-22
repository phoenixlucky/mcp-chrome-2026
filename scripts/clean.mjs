import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const mode = process.argv[2];

if (!['--dist', '--modules'].includes(mode)) {
  console.error('Usage: node scripts/clean.mjs --dist|--modules');
  process.exitCode = 1;
} else {
  const workspaceDirs = [
    root,
    ...(await workspaceDirectories(path.join(root, 'app'))),
    ...(await workspaceDirectories(path.join(root, 'packages'))),
  ];
  const targets = mode === '--dist' ? ['dist', '.turbo'] : ['node_modules'];

  for (const directory of workspaceDirs) {
    for (const target of targets) {
      await fs.rm(path.join(directory, target), { recursive: true, force: true });
    }
  }
}

async function workspaceDirectories(parent) {
  const entries = await fs.readdir(parent, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parent, entry.name));
}
