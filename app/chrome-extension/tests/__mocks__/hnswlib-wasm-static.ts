/**
 * @fileoverview Mock for hnswlib-wasm-static
 * @description Provides a stub for vector database in test environment
 */

let syncFSCallCount = 0;
let maxConcurrentSyncFS = 0;
let activeSyncFS = 0;
let waitForFileSystemSyncedCallCount = 0;

const EmscriptenFileSystemManager = {
  initializeFileSystem() {},
  isInitialized: () => true,
  isSynced: () => true,
  setDebugLogs() {},
  checkFileExists: () => false,
  syncFS: (_read: boolean, callback: () => void) => {
    syncFSCallCount += 1;
    activeSyncFS += 1;
    maxConcurrentSyncFS = Math.max(maxConcurrentSyncFS, activeSyncFS);
    // Match the package contract: the returned promise can resolve as soon as
    // the request is dispatched; the callback signals actual FS completion.
    const dispatched = Promise.resolve(true);
    setTimeout(() => {
      callback();
      activeSyncFS -= 1;
    }, 1);
    return dispatched;
  },
};

export const HierarchicalNSW = class MockHierarchicalNSW {
  constructor() {}
  initIndex() {}
  setEfSearch() {}
  addPoint() {}
  writeIndex() {}
  searchKnn() {
    return { neighbors: [], distances: [] };
  }
  getCurrentCount() {
    return 0;
  }
  resizeIndex() {}
  getPoint() {
    return [];
  }
  markDelete() {}
};

export const loadHnswlib = async () => ({ HierarchicalNSW, EmscriptenFileSystemManager });

export const waitForFileSystemSynced = async () => {
  waitForFileSystemSyncedCallCount += 1;
};

export const resetHnswlibMock = () => {
  syncFSCallCount = 0;
  maxConcurrentSyncFS = 0;
  activeSyncFS = 0;
  waitForFileSystemSyncedCallCount = 0;
};

export const getHnswlibMockStats = () => ({
  syncFSCallCount,
  maxConcurrentSyncFS,
  waitForFileSystemSyncedCallCount,
});

export default { HierarchicalNSW, EmscriptenFileSystemManager };
