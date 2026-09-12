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

  it('scrolls a ref into view before DOM hover fallback', async () => {
    const button = document.createElement('button');
    setRect(button);
    button.dispatchEvent = vi.fn(() => true);
    document.body.append(button);
    (window as any).__claudeElementMap.ref_hover = { deref: () => button };
    vi.stubGlobal('MouseEvent', class {});

    const handler = loadInjectedHelper(
      'accessibility-tree-helper.js',
      '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__',
    );

    await expect(
      callHelper(handler, { action: 'dispatchHoverForRef', ref: 'ref_hover' }),
    ).resolves.toMatchObject({ success: true });
    expect(button.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'instant',
      block: 'center',
      inline: 'center',
    });
  });

  it('recovers a ref after a framework replaces the original node', async () => {
    const original = document.createElement('button');
    original.id = 'replaceable';
    setRect(original);
    document.body.append(original);

    const handler = loadInjectedHelper(
      'accessibility-tree-helper.js',
      '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__',
    );
    const ensured = await callHelper(handler, {
      action: 'ensureRefForSelector',
      selector: '#replaceable',
      scrollIntoView: false,
    });
    expect(ensured.success).toBe(true);

    original.remove();
    const replacement = document.createElement('button');
    replacement.id = 'replaceable';
    setRect(replacement);
    document.body.append(replacement);
    mockElementFromPoint(replacement);

    await expect(
      callHelper(handler, {
        action: 'locateElement',
        ref: ensured.ref,
        scrollIntoView: false,
        highlight: false,
      }),
    ).resolves.toMatchObject({
      success: true,
      ref: ensured.ref,
      selector: '#replaceable',
    });
  });

  it('ignores hidden selector clones and locates the visible match', async () => {
    const hidden = document.createElement('button');
    hidden.style.display = 'none';
    document.body.append(hidden);
    const visible = document.createElement('button');
    setRect(visible);
    document.body.append(visible);

    const handler = loadInjectedHelper(
      'accessibility-tree-helper.js',
      '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__',
    );
    await expect(
      callHelper(handler, {
        action: 'locateElement',
        selector: 'button',
        scrollIntoView: false,
        highlight: false,
      }),
    ).resolves.toMatchObject({ success: true, matchCount: 1 });
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

  it('finds ARIA autocomplete options by visible text', async () => {
    const option = document.createElement('div');
    option.setAttribute('role', 'option');
    option.textContent = 'dsh-plugin';
    setRect(option);
    document.body.append(option);

    const handler = loadInjectedHelper(
      'interactive-elements-helper.js',
      '__INTERACTIVE_ELEMENTS_HELPER_INITIALIZED__',
    );

    await expect(
      callHelper(handler, {
        action: 'getInteractiveElements',
        textQuery: 'dsh-plugin',
        includeCoordinates: false,
      }),
    ).resolves.toMatchObject({
      success: true,
      elements: [
        expect.objectContaining({
          role: 'option',
          text: 'dsh-plugin',
        }),
      ],
    });
  });

  it('uses the only visible combobox when a placeholder selector is stale', async () => {
    const input = document.createElement('input');
    input.setAttribute('role', 'combobox');
    setRect(input);
    document.body.append(input);
    mockElementFromPoint(input);

    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'fillElement',
        selector: 'input[placeholder="Add topics"]',
        value: 'dsh-plugin',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(input.value).toBe('dsh-plugin');
  });

  it('clicks a visible element even when another element wins center-point hit testing', async () => {
    const button = document.createElement('button');
    button.textContent = 'Edit repository metadata';
    setRect(button);
    document.body.append(button);

    const overlay = document.createElement('div');
    setRect(overlay);
    document.body.append(overlay);
    mockElementFromPoint(overlay);

    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        selector: 'button',
      }),
    ).resolves.toMatchObject({
      success: true,
      clicked: true,
      elementInfo: {
        isVisible: true,
        isHitTestVisible: false,
      },
    });
  });

  it('rejects an ambiguous click selector instead of clicking the first match', async () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    setRect(first);
    setRect(second);
    document.body.append(first, second);

    const elementFromPoint = mockElementFromPoint(first);
    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        selector: 'button',
      }),
    ).resolves.toMatchObject({
      error: 'Selector "button" matched multiple elements. Please refine it or use an element ref.',
      matchCount: 2,
    });
    expect(elementFromPoint).not.toHaveBeenCalled();
  });

  it("accepts legacy text locators such as button('Start discussion')", async () => {
    const button = document.createElement('button');
    button.textContent = 'Start discussion';
    setRect(button);
    document.body.append(button);
    mockElementFromPoint(button);

    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        selector: "button('Start discussion')",
        timeout: 100,
      }),
    ).resolves.toMatchObject({ success: true, clicked: true });
  });

  it('accepts legacy indexed path selectors and forwards XPath mode', async () => {
    const button = document.createElement('button');
    button.textContent = 'Start discussion';
    setRect(button);
    const firstContainer = document.createElement('div');
    firstContainer.append(button);
    document.body.append(firstContainer);
    mockElementFromPoint(button);

    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        selector: 'body > div(1) > button',
        timeout: 100,
      }),
    ).resolves.toMatchObject({ success: true, clicked: true });

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        selector: "//button[normalize-space(.)='Start discussion']",
        selectorType: 'xpath',
        timeout: 100,
      }),
    ).resolves.toMatchObject({ success: true, clicked: true });
  });
});
