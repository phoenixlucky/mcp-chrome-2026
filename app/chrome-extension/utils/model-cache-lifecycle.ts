import { ModelCacheManager } from './model-cache-manager';

export async function hasAnyModelCache(): Promise<boolean> {
  try {
    return await ModelCacheManager.getInstance().hasAnyValidCache();
  } catch (error) {
    console.error('Error checking for any model cache:', error);
    return false;
  }
}

export async function cleanupModelCache(): Promise<void> {
  try {
    await ModelCacheManager.getInstance().manualCleanup();
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
    throw error;
  }
}
