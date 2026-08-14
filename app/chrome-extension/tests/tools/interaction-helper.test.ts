import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

type MessageHandler = (
  request: Record<string, unknown>,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void;

function loadInjectedHelper(fileName: string, initializedFlag: string): MessageHandler {
  const chromeApi = (globalThis as { chrome: any }).chrome;
  const listeners: MessageHandler[] = [];
  const previousListener = chromeApi.runtime.onMessage.addListener;
  chromeApi.runtime.onMessage.addListener = (handler: MessageHandler) => {
    listeners.push(handler);
  };
  (window as any).chrome = chromeApi;
  delete (window as any)[initializedFlag];
  window.eval(readFileSync(resolve(process.cwd(), 'inject-scripts', fileName), 'utf8'));
  chromeApi.runtime.onMessage.addListener = previousListener;

  const handler = listeners.at(-1);
  if (!handler) throw new Error(`No message handler registered by ${fileName}`);
  return handler;
}

function callHelper(handler: MessageHandler, request: Record<string, unknown>): Promise<any> {
  return new Promise((resolve) => {
    handler(request, {}, resolve);
  });
}

function setRect(element: Element, width = 120, height = 32): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      width,
      height,
      top: 0,
      right: width,
      bottom: height,
      left: 0,
    }),
  });
  Object.defineProperty(element, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
}

function mockElementFromPoint(element: Element): ReturnType<typeof vi.fn> {
  const mock = vi.fn(() => element);
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    writable: true,
    value: mock,
  });
  return mock;
}

describe('interaction helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__claudeElementMap = {};
    vi.restoreAllMocks();
  });

  it('rejects click requests without a target instead of querying an undefined selector', async () => {
    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(callHelper(handler, { action: 'clickElement' })).resolves.toMatchObject({
      error: 'Click target is missing a valid selector, ref, or coordinates',
    });
  });

  it('recovers a click from a selector when the ref has expired', async () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', '选择 image.jpg - 1');
    setRect(button);
    document.body.append(button);

    const elementFromPoint = mockElementFromPoint(button);
    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        ref: 'ref_expired',
        selector: 'button[aria-label^="选择 image.jpg"]',
        timeout: 100,
      }),
    ).resolves.toMatchObject({ success: true, clicked: true });
    expect(elementFromPoint).toHaveBeenCalled();
  });

  it('recovers a fill from a selector when the ref has expired', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'private';
    setRect(input);
    document.body.append(input);
    mockElementFromPoint(input);

    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'fillElement',
        ref: 'ref_expired',
        selector: '#private',
        value: 'private',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(input.value).toBe('private');
  });

  it('waits for dynamic inputs and matches value properties when the value attribute is absent', async () => {
    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');

    const responsePromise = callHelper(handler, {
      action: 'fillElement',
      selector: "input[value='private']",
      value: 'updated',
      timeout: 300,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'private';
    setRect(input);
    document.body.append(input);
    mockElementFromPoint(input);

    await expect(responsePromise).resolves.toMatchObject({ success: true });
    expect(input.value).toBe('updated');
  });
});
