import { afterEach, describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ArtifactStore } from './artifact-store.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function makeStore(): ArtifactStore {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-mcp-artifact-test-'));
  roots.push(root);
  return new ArtifactStore(root);
}

describe('ArtifactStore', () => {
  test('removes an interrupted partial upload', () => {
    const store = makeStore();
    const data = Buffer.from('artifact payload');
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');

    store.receiveChunk({
      artifactId: 'interrupted',
      contentType: 'text/plain',
      size: data.length,
      sha256,
      seq: 0,
      eof: false,
      data: data.subarray(0, 5).toString('base64'),
    });
    expect(fs.existsSync(path.join(store.rootDir, 'interrupted.part'))).toBe(true);

    store.dispose();
    expect(fs.existsSync(path.join(store.rootDir, 'interrupted.part'))).toBe(false);
    expect(store.get('interrupted')).toBeUndefined();
  });

  test('atomically publishes a complete artifact after ordered chunks', () => {
    const store = makeStore();
    const data = Buffer.from('complete artifact');
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const common = { artifactId: 'complete', contentType: 'text/plain', size: data.length, sha256 };

    expect(
      store.receiveChunk({
        ...common,
        seq: 0,
        eof: false,
        data: data.subarray(0, 8).toString('base64'),
      }),
    ).toBeUndefined();
    const metadata = store.receiveChunk({
      ...common,
      seq: 1,
      eof: true,
      data: data.subarray(8).toString('base64'),
    });
    expect(metadata).toEqual(common);
    expect(fs.existsSync(path.join(store.rootDir, 'complete.part'))).toBe(false);
    expect(fs.readFileSync(path.join(store.rootDir, 'complete.artifact'))).toEqual(data);
  });
});
