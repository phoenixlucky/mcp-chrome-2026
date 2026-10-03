import { OffscreenManager } from './offscreen-manager';
import { OFFSCREEN_MESSAGE_TYPES } from '@/common/message-types';
import type { ModelPreset } from './semantic-models';

interface ModelConfig {
  modelIdentifier: string;
  localModelPathPrefix?: string; // Base path for local models (relative to public)
  onnxModelFile?: string; // ONNX model filename
  maxLength?: number;
  cacheSize?: number;
  numThreads?: number;
  useLocalFiles?: boolean;
  workerPath?: string; // Worker script path (relative to extension root)
  concurrentLimit?: number; // Worker task concurrency limit
  forceOffscreen?: boolean; // Force offscreen mode (for testing)
  modelPreset?: ModelPreset; // Predefined model selection
  dimension?: number; // Vector dimension (auto-obtained from preset model)
  modelVersion?: 'full' | 'quantized' | 'compressed'; // Model version selection
  requiresTokenTypeIds?: boolean; // Whether model requires token_type_ids input
}

/**
 * SemanticSimilarityEngine proxy class
 * Used by ContentIndexer and other components to reuse engine instance in offscreen, avoiding duplicate model downloads
 */
export class SemanticSimilarityEngineProxy {
  private _isInitialized = false;
  private config: Partial<ModelConfig>;
  private offscreenManager: OffscreenManager;
  private _isEnsuring = false; // Flag to prevent concurrent ensureOffscreenEngineInitialized calls

  constructor(config: Partial<ModelConfig> = {}) {
    this.config = config;
    this.offscreenManager = OffscreenManager.getInstance();
    console.log('SemanticSimilarityEngineProxy: Proxy created with config:', {
      modelPreset: config.modelPreset,
      modelVersion: config.modelVersion,
      dimension: config.dimension,
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log('SemanticSimilarityEngineProxy: Starting proxy initialization...');

      // Ensure offscreen document exists
      console.log('SemanticSimilarityEngineProxy: Ensuring offscreen document exists...');
      await this.offscreenManager.ensureOffscreenDocument();
      console.log('SemanticSimilarityEngineProxy: Offscreen document ready');

      // Ensure engine in offscreen is initialized
      console.log('SemanticSimilarityEngineProxy: Ensuring offscreen engine is initialized...');
      await this.ensureOffscreenEngineInitialized();

      this._isInitialized = true;
      console.log(
        'SemanticSimilarityEngineProxy: Proxy initialized, delegating to offscreen engine',
      );
    } catch (error) {
      console.error('SemanticSimilarityEngineProxy: Initialization failed:', error);
      throw new Error(
        `Failed to initialize proxy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check engine status in offscreen
   */
  private async checkOffscreenEngineStatus(): Promise<{
    isInitialized: boolean;
    currentConfig: any;
  }> {
    try {
      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_STATUS,
      });

      if (response && response.success) {
        return {
          isInitialized: response.isInitialized || false,
          currentConfig: response.currentConfig || null,
        };
      }
    } catch (error) {
      console.warn('SemanticSimilarityEngineProxy: Failed to check engine status:', error);
    }

    return { isInitialized: false, currentConfig: null };
  }

  /**
   * Ensure engine in offscreen is initialized (with concurrency protection)
   */
  private async ensureOffscreenEngineInitialized(): Promise<void> {
    // Prevent concurrent initialization attempts
    if (this._isEnsuring) {
      console.log('SemanticSimilarityEngineProxy: Already ensuring initialization, waiting...');
      // Wait a bit and check again
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }

    try {
      this._isEnsuring = true;
      const status = await this.checkOffscreenEngineStatus();

      if (!status.isInitialized) {
        console.log(
          'SemanticSimilarityEngineProxy: Engine not initialized in offscreen, initializing...',
        );

        // Reinitialize engine
        const response = await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_INIT,
          config: this.config,
        });

        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to initialize engine in offscreen document');
        }

        console.log('SemanticSimilarityEngineProxy: Engine reinitialized successfully');
      }
    } finally {
      this._isEnsuring = false;
    }
  }

  /**
   * Send message to offscreen document with retry mechanism and auto-reinitialization
   */
  private async sendMessageToOffscreen(message: any, maxRetries: number = 3): Promise<any> {
    // Make sure the offscreen document exists
    await this.offscreenManager.ensureOffscreenDocument();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `SemanticSimilarityEngineProxy: Sending message (attempt ${attempt}/${maxRetries}):`,
          message.type,
        );

        const response = await chrome.runtime.sendMessage(message);

        if (!response) {
          throw new Error('No response received from offscreen document');
        }

        // If engine not initialized error received, try to reinitialize
        if (!response.success && response.error && response.error.includes('not initialized')) {
          console.log(
            'SemanticSimilarityEngineProxy: Engine not initialized, attempting to reinitialize...',
          );
          await this.ensureOffscreenEngineInitialized();

          // Resend original message
          const retryResponse = await chrome.runtime.sendMessage(message);
          if (retryResponse && retryResponse.success) {
            return retryResponse;
          }
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `SemanticSimilarityEngineProxy: Message failed (attempt ${attempt}/${maxRetries}):`,
          error,
        );

        // If engine not initialized error, try to reinitialize
        if (error instanceof Error && error.message.includes('not initialized')) {
          try {
            console.log(
              'SemanticSimilarityEngineProxy: Attempting to reinitialize engine due to error...',
            );
            await this.ensureOffscreenEngineInitialized();

            // Resend original message
            const retryResponse = await chrome.runtime.sendMessage(message);
            if (retryResponse && retryResponse.success) {
              return retryResponse;
            }
          } catch (reinitError) {
            console.warn(
              'SemanticSimilarityEngineProxy: Failed to reinitialize engine:',
              reinitError,
            );
          }
        }

        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));

          // Re-ensure offscreen document exists
          try {
            await this.offscreenManager.ensureOffscreenDocument();
          } catch (offscreenError) {
            console.warn(
              'SemanticSimilarityEngineProxy: Failed to ensure offscreen document:',
              offscreenError,
            );
          }
        }
      }
    }

    throw new Error(
      `Failed to communicate with offscreen document after ${maxRetries} attempts. Last error: ${lastError?.message}`,
    );
  }

  async getEmbedding(text: string, options: Record<string, any> = {}): Promise<Float32Array> {
    if (!this._isInitialized) {
      await this.initialize();
    }

    // Check and ensure engine is initialized before each call
    await this.ensureOffscreenEngineInitialized();

    const response = await this.sendMessageToOffscreen({
      target: 'offscreen',
      type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_COMPUTE,
      text: text,
      options: options,
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to get embedding from offscreen document');
    }

    if (!response.embedding || !Array.isArray(response.embedding)) {
      throw new Error('Invalid embedding data received from offscreen document');
    }

    return new Float32Array(response.embedding);
  }

  async getEmbeddingsBatch(
    texts: string[],
    options: Record<string, any> = {},
  ): Promise<Float32Array[]> {
    if (!this._isInitialized) {
      await this.initialize();
    }

    if (!texts || texts.length === 0) return [];

    // Check and ensure engine is initialized before each call
    await this.ensureOffscreenEngineInitialized();

    const response = await this.sendMessageToOffscreen({
      target: 'offscreen',
      type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_BATCH_COMPUTE,
      texts: texts,
      options: options,
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to get embeddings batch from offscreen document');
    }

    return response.embeddings.map((emb: number[]) => new Float32Array(emb));
  }

  async computeSimilarity(
    text1: string,
    text2: string,
    options: Record<string, any> = {},
  ): Promise<number> {
    const [embedding1, embedding2] = await this.getEmbeddingsBatch([text1, text2], options);
    return this.cosineSimilarity(embedding1, embedding2);
  }

  async computeSimilarityBatch(
    pairs: { text1: string; text2: string }[],
    options: Record<string, any> = {},
  ): Promise<number[]> {
    if (!this._isInitialized) {
      await this.initialize();
    }

    // Check and ensure engine is initialized before each call
    await this.ensureOffscreenEngineInitialized();

    const response = await this.sendMessageToOffscreen({
      target: 'offscreen',
      type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_BATCH_COMPUTE,
      pairs: pairs,
      options: options,
    });

    if (!response || !response.success) {
      throw new Error(
        response?.error || 'Failed to compute similarity batch from offscreen document',
      );
    }

    return response.similarities;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async dispose(): Promise<void> {
    // Proxy class doesn't need to clean up resources, actual resources are managed by offscreen
    this._isInitialized = false;
    console.log('SemanticSimilarityEngineProxy: Proxy disposed');
  }
}
