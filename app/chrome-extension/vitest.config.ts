import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Match WXT's path aliases from .wxt/tsconfig.json
      '@': rootDir,
      '~': rootDir,
      // Resolve the workspace package to source so tests do not depend on a
      // concurrently rebuilt packages/shared/dist directory.
      '@ethanwilkins/chrome-mcp-shared-2026': resolve(
        rootDir,
        '../../packages/shared/src/index.ts',
      ),
      // Mock hnswlib-wasm-static to avoid native module issues in tests
      'hnswlib-wasm-static': `${rootDir}/tests/__mocks__/hnswlib-wasm-static.ts`,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.output', 'dist', '.wxt'],
    setupFiles: ['tests/vitest.setup.ts'],
    environmentOptions: {
      jsdom: {
        // Provide a stable URL for anchor/href tests
        url: 'https://example.com/',
      },
    },
    // Auto-cleanup mocks between tests
    clearMocks: true,
    restoreMocks: true,
    // TypeScript support via esbuild (faster than ts-jest)
    typecheck: {
      enabled: false, // Run separately with vue-tsc
    },
  },
});
