import { describe, expect, it, beforeEach } from 'vitest';

import { VectorDatabase } from '@/utils/vector-database';
import { getHnswlibMockStats, resetHnswlibMock } from './__mocks__/hnswlib-wasm-static';

describe('VectorDatabase filesystem sync', () => {
  beforeEach(() => {
    resetHnswlibMock();
  });

  it('waits for the sync callback instead of overlapping IDBFS writes', async () => {
    const database = new VectorDatabase({
      dimension: 2,
      enableAutoCleanup: false,
    });

    await database.initialize();

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        database.addDocument(
          1,
          'https://example.com',
          'Example',
          {
            index,
            text: `chunk ${index}`,
            source: 'test',
            wordCount: 2,
          },
          new Float32Array([index, index + 1]),
        ),
      ),
    );

    const stats = getHnswlibMockStats();
    expect(stats.waitForFileSystemSyncedCallCount).toBe(1);
    expect(stats.syncFSCallCount).toBeGreaterThan(0);
    expect(stats.maxConcurrentSyncFS).toBe(1);
  });
});
