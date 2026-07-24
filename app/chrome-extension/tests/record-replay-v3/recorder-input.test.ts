import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const recorderSource = readFileSync(resolve('inject-scripts/recorder.js'), 'utf8');

describe('page recorder input', () => {
  it('records a textarea input as a fill step before stop', async () => {
    const listeners: Array<(request: any, sender: any, reply: (value: any) => void) => unknown> =
      [];
    const sent: any[] = [];
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: (listener: any) => listeners.push(listener) },
        sendMessage: (message: any, callback: (response: any) => void) => {
          sent.push(message);
          callback({ ok: true });
        },
      },
    });

    window.eval(recorderSource);
    const listener = listeners[0]!;
    await new Promise<void>((resolve) =>
      listener({ action: 'rr_recorder_control', cmd: 'start' }, {}, resolve),
    );

    const input = document.createElement('textarea');
    document.body.append(input);
    input.dispatchEvent(new Event('focusin', { bubbles: true }));
    input.value = '你好啊';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await new Promise<void>((resolve) =>
      listener({ action: 'rr_recorder_control', cmd: 'stop' }, {}, () => resolve()),
    );

    const steps = sent
      .filter(
        (message) => message.type === 'rr_recorder_event' && message.payload?.kind === 'steps',
      )
      .flatMap((message) => message.payload.steps);
    expect(steps).toContainEqual(expect.objectContaining({ type: 'fill', value: '你好啊' }));
  });
});
