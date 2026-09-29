import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./clean.mjs', import.meta.url));

function makeWorkspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-clean-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  for (const workspace of ['', 'app/extension', 'packages/shared']) {
    const base = path.join(root, workspace);
    fs.mkdirSync(base, { recursive: true });
    for (const directory of ['dist', '.output', '.turbo', 'node_modules']) {
      const marker = path.join(base, directory, 'marker');
      fs.mkdirSync(path.dirname(marker), { recursive: true });
      fs.writeFileSync(marker, 'generated');
    }
  }

  fs.mkdirSync(path.join(root, '.windows-stage'), { recursive: true });
  fs.writeFileSync(path.join(root, '.windows-stage', 'marker'), 'generated');
  return root;
}

test('--dist removes generated outputs from root and workspace directories', (t) => {
  const root = makeWorkspace(t);
  execFileSync(process.execPath, [script, '--dist'], { cwd: root });

  for (const workspace of ['', 'app/extension', 'packages/shared']) {
    for (const directory of ['dist', '.output', '.turbo']) {
      assert.equal(fs.existsSync(path.join(root, workspace, directory)), false);
    }
    assert.equal(fs.existsSync(path.join(root, workspace, 'node_modules', 'marker')), true);
  }

  assert.equal(fs.existsSync(path.join(root, '.windows-stage')), false);
});

test('--modules removes node_modules and preserves generated build outputs', (t) => {
  const root = makeWorkspace(t);
  execFileSync(process.execPath, [script, '--modules'], { cwd: root });

  for (const workspace of ['', 'app/extension', 'packages/shared']) {
    assert.equal(fs.existsSync(path.join(root, workspace, 'node_modules')), false);
    assert.equal(fs.existsSync(path.join(root, workspace, 'dist', 'marker')), true);
  }
});

test('invalid mode fails without deleting files', (t) => {
  const root = makeWorkspace(t);
  assert.throws(
    () => execFileSync(process.execPath, [script, '--unknown'], { cwd: root, stdio: 'pipe' }),
    { status: 1 },
  );
  assert.equal(fs.existsSync(path.join(root, 'dist', 'marker')), true);
});
