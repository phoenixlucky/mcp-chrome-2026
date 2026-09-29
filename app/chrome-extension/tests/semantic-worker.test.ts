import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const workerSource = readFileSync(resolve(process.cwd(), 'workers/similarity.worker.js'), 'utf8');

function createWorker(webAssembly: typeof WebAssembly) {
  const messages: any[] = [];
  const postMessage = vi.fn((message: unknown) => messages.push(message));
  const createSession = vi.fn(async () => ({ inputNames: ['input_ids', 'attention_mask'] }));
  const self: any = { postMessage };
  const ort = {
    env: { wasm: {} as Record<string, unknown> },
    InferenceSession: { create: createSession },
  };

  runInNewContext(workerSource, {
    self,
    ort,
    WebAssembly: webAssembly,
    importScripts: vi.fn(),
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });

  return { self, ort, messages, createSession };
}

describe('similarity worker WASM runtime', () => {
  it('initializes inference sessions with the WASM execution provider', async () => {
    const worker = createWorker(WebAssembly);
    await worker.self.onmessage({
      data: { id: 'init-1', type: 'init', payload: { modelPath: 'model.onnx' } },
    });

    expect(worker.createSession).toHaveBeenCalledWith(
      'model.onnx',
      expect.objectContaining({
        executionProviders: ['wasm'],
      }),
    );
    expect(worker.messages.at(-1)).toMatchObject({ id: 'init-1', type: 'init_complete' });
  });

  it('returns an actionable error when the environment cannot run WebAssembly', async () => {
    const unsupportedWasm = { validate: () => false } as unknown as typeof WebAssembly;
    const worker = createWorker(unsupportedWasm);
    await worker.self.onmessage({
      data: { id: 'init-2', type: 'init', payload: { modelPath: 'model.onnx' } },
    });

    expect(worker.createSession).not.toHaveBeenCalled();
    expect(worker.messages.at(-1)).toMatchObject({
      id: 'init-2',
      type: 'init_error',
      payload: { message: expect.stringContaining('WebAssembly is required') },
    });
  });

  it('rejects execution providers that are not shipped in the extension', async () => {
    const worker = createWorker(WebAssembly);
    await worker.self.onmessage({
      data: {
        id: 'init-3',
        type: 'init',
        payload: { modelPath: 'model.onnx', executionProviders: ['webgpu'] },
      },
    });

    expect(worker.createSession).not.toHaveBeenCalled();
    expect(worker.messages.at(-1)).toMatchObject({
      id: 'init-3',
      type: 'init_error',
      payload: {
        message: expect.stringContaining('Only the wasm execution provider is supported'),
      },
    });
  });
});
