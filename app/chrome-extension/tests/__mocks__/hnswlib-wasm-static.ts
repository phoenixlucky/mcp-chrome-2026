/**
 * @fileoverview Mock for hnswlib-wasm-static
 * @description Provides a stub for vector database in test environment
 */

let syncFSCallCount = 0;
let maxConcurrentSyncFS = 0;
let activeSyncFS = 0;
let waitForFileSystemSyncedCallCount = 0;
let isFileSystemSynced = true;
let syncWaiters: Array<() => void> = [];
let lastAutoSaveFilename = null as string | null;

const EmscriptenFileSystemManager = {
  initializeFileSystem() {},
  isInitialized: () => true,
  isSynced: () => isFileSystemSynced,
  setDebugLogs() {},
  checkFileExists: () => false,
  syncFS: (_read: boolean, callback: () => void) => {
    syncFSCallCount += 1;
    activeSyncFS += 1;
    isFileSystemSynced = false;
    maxConcurrentSyncFS = Math.max(maxConcurrentSyncFS, activeSyncFS);
    // Match the package contract: the returned promise can resolve as soon as
    // the request is dispatched; the callback signals actual FS completion.
    const dispatched = Promise.resolve(true);
    setTimeout(() => {
      callback();
      activeSyncFS -= 1;
      isFileSystemSynced = true;
      const waiters = syncWaiters;
      syncWaiters = [];
      waiters.forEach((waiter) => waiter());
    }, 1);
    return dispatched;
  },
};

export const HierarchicalNSW = class MockHierarchicalNSW {
  constructor(_spaceName?: string, _dimension?: number, autoSaveFilename?: string) {
    lastAutoSaveFilename = autoSaveFilename ?? null;
  }
  initIndex() {}
  setEfSearch() {}
  addPoint() {}
  writeIndex() {
    EmscriptenFileSystemManager.syncFS(false, () => undefined);
  }
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
  if (isFileSystemSynced) return;
  await new Promise<void>((resolve) => syncWaiters.push(resolve));
};

export const resetHnswlibMock = () => {
  syncFSCallCount = 0;
  maxConcurrentSyncFS = 0;
  activeSyncFS = 0;
  waitForFileSystemSyncedCallCount = 0;
  isFileSystemSynced = true;
  syncWaiters = [];
  lastAutoSaveFilename = null;
};

export const getHnswlibMockStats = () => ({
  syncFSCallCount,
  maxConcurrentSyncFS,
  waitForFileSystemSyncedCallCount,
  lastAutoSaveFilename,
});

export default { HierarchicalNSW, EmscriptenFileSystemManager };
