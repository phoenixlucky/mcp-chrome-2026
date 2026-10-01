import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'inject-scripts/accessibility-tree-helper.js'),
  'utf8',
);

type MessageHandler = (
  request: Record<string, unknown>,
  sender: unknown,
  respond: (response: any) => void,
) => boolean | void;

function loadHelper(view: Window): MessageHandler {
  const chromeApi = (globalThis as { chrome: any }).chrome;
  const listeners: MessageHandler[] = [];
  vi.spyOn(chromeApi.runtime.onMessage, 'addListener').mockImplementation((handler) => {
    listeners.push(handler as MessageHandler);
  });
  (view as any).chrome = chromeApi;
  delete (view as any).__ACCESSIBILITY_TREE_HELPER_INITIALIZED__;
  (view as any).eval(source);
  const handler = listeners.at(-1);
  if (!handler) throw new Error('Accessibility helper did not register');
  return handler;
}

function rect(element: Element, left: number, top: number): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left, top, right: left + 20, bottom: top + 10, width: 20, height: 10 }),
  });
}

describe('composite iframe list validation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns every child-frame match for a composite list selector', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    rect(frame, 100, 200);
    const handler = loadHelper(window);
    vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation((request: any) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: frame.contentWindow,
          data: {
            type: 'rr-bridge-ensure-ref-result',
            reqId: request.reqId,
            success: true,
            ref: 'ref_one',
            center: { x: 5, y: 10 },
            elements: [
              { ref: 'ref_one', selector: '#one', center: { x: 5, y: 10 } },
              { ref: 'ref_two', selector: '#two', center: { x: 15, y: 20 } },
            ],
          },
        }),
      );
    });

    const result = await new Promise<any>((resolve) => {
      handler(
        {
          action: 'ensureRefForSelector',
          selector: 'iframe |> #one, #two',
          allowMultiple: true,
          scrollIntoView: false,
        },
        {},
        resolve,
      );
    });

    expect(result.elements).toEqual([
      { ref: 'ref_one', selector: '#one', center: { x: 105, y: 210 } },
      { ref: 'ref_two', selector: '#two', center: { x: 115, y: 220 } },
    ]);
  });

  it('collects all visible child-frame matches for an allowMultiple bridge request', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const child = frame.contentWindow!;
    child.document.body.innerHTML = '<button id="one">One</button><button id="two">Two</button>';
    rect(child.document.querySelector('#one')!, 1, 2);
    rect(child.document.querySelector('#two')!, 11, 12);
    loadHelper(child);
    const postMessage = vi.spyOn(child.top!, 'postMessage').mockImplementation(() => {});

    child.dispatchEvent(
      new MessageEvent('message', {
        source: child.top,
        data: {
          type: 'rr-bridge-ensure-ref',
          reqId: 'request',
          selector: '#one, #two',
          allowMultiple: true,
        },
      }),
    );

    const result = postMessage.mock.lastCall?.[0] as any;
    expect(result.success).toBe(true);
    expect(result.elements.map((item: any) => item.center)).toEqual([
      { x: 11, y: 7 },
      { x: 21, y: 17 },
    ]);
    expect(result.elements.every((item: any) => item.ref)).toBe(true);
  });
});
