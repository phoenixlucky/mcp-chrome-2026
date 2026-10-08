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

  it('builds a structured action snapshot and omits sensitive inputs', () => {
    const button = document.createElement('button');
    button.textContent = 'Search';
    setRect(button);
    const email = document.createElement('input');
    email.type = 'email';
    email.setAttribute('aria-label', 'Email');
    email.value = 'a@example.test';
    setRect(email);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', 'Remember me');
    setRect(checkbox);
    const password = document.createElement('input');
    password.type = 'password';
    password.setAttribute('aria-label', 'Password');
    setRect(password);
    document.body.append(button, email, checkbox, password);

    const helper = loadInjectedHelper(
      'accessibility-tree-helper.js',
      '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__',
    );
    const generate = (window as any).__generateActionSnapshot;
    expect(generate).toBeTypeOf('function');
    if (typeof generate !== 'function') return;

    const snapshot = generate('snapshot-1');
    expect(snapshot).toMatchObject({
      snapshotId: 'snapshot-1',
      controls: [
        expect.objectContaining({ role: 'button', name: 'Search', operations: ['click'] }),
        expect.objectContaining({
          role: 'textbox',
          name: 'Email',
          value: 'a@example.test',
          operations: ['type_text'],
        }),
        expect.objectContaining({ role: 'checkbox', name: 'Remember me', operations: ['select'] }),
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain('Password');
    expect(typeof helper).toBe('function');
  });

  it('serves an action snapshot in one read and records a deterministic discovery baseline', async () => {
    const button = document.createElement('button');
    button.textContent = 'Save';
    setRect(button);
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Title');
    input.value = 'known-state';
    setRect(input);
    document.body.append(button, input);

    const accessibility = loadInjectedHelper(
      'accessibility-tree-helper.js',
      '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__',
    );
    const interactive = loadInjectedHelper(
      'interactive-elements-helper.js',
      '__INTERACTIVE_ELEMENTS_HELPER_INITIALIZED__',
    );
    const startLegacy = performance.now();
    const tree = await callHelper(accessibility, { action: 'generateAccessibilityTree' });
    const elements = await callHelper(interactive, { action: 'getInteractiveElements' });
    const legacyMs = performance.now() - startLegacy;
    expect(tree.success).toBe(true);
    expect(elements.success).toBe(true);

    const snapshotStart = performance.now();
    const snapshot = await callHelper(accessibility, {
      action: 'generateActionSnapshot',
      snapshotId: 'baseline-snapshot',
    });
    const snapshotMs = performance.now() - snapshotStart;
    expect(snapshot).toMatchObject({
      success: true,
      snapshotId: 'baseline-snapshot',
      controls: [
        expect.objectContaining({ name: 'Save' }),
        expect.objectContaining({ name: 'Title', value: 'known-state' }),
      ],
    });
    expect(snapshot.controls.find((control: any) => control.name === 'Title').value).toBe(
      input.value,
    );
    console.info(
      '[action-snapshot-baseline]',
      JSON.stringify({
        legacyReadCalls: 2,
        snapshotReadCalls: 1,
        legacyMs,
        snapshotMs,
        domVerified: true,
      }),
    );
  });

  it('caps controls, reuses refs, and expires snapshot guards after 30 seconds', () => {
    const first = document.createElement('button');
    first.textContent = 'First';
    setRect(first);
    const second = document.createElement('button');
    second.textContent = 'Second';
    setRect(second);
    document.body.append(first, second);
    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const generate = (window as any).__generateActionSnapshot;
    const verify = (window as any).__verifyActionSnapshot;

    const limited = generate('limited-snapshot', 1);
    const repeated = generate('repeated-snapshot', 1);
    expect(limited.controls).toHaveLength(1);
    expect(limited.truncated).toBe(true);
    expect(repeated.controls[0].ref).toBe(limited.controls[0].ref);
    expect(verify('limited-snapshot', limited.controls[0].ref, 'click')).toMatchObject({
      success: true,
    });

    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(30_001);
      expect(verify('limited-snapshot', limited.controls[0].ref, 'click')).toMatchObject({
        success: false,
        error: expect.stringContaining('expired'),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the snapshot truncated when visible page text exceeds its cap', () => {
    const content = document.createElement('div');
    content.textContent = 'Visible text '.repeat(600);
    setRect(content);
    document.body.append(content);
    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');

    const snapshot = (window as any).__generateActionSnapshot('snapshot-long-text');
    expect(snapshot.text).toHaveLength(6_000);
    expect(snapshot.truncated).toBe(true);
  });

  it('recovers a click from a selector when the ref has expired', async () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Select image.jpg - 1');
    setRect(button);
    document.body.append(button);

    const elementFromPoint = mockElementFromPoint(button);
    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        ref: 'ref_expired',
        selector: 'button[aria-label^="Select image.jpg"]',
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

  it('rejects snapshot-scoped clicks when the snapshot is missing', async () => {
    const button = document.createElement('button');
    button.textContent = 'Continue';
    setRect(button);
    const click = vi.fn();
    button.addEventListener('click', click);
    document.body.append(button);
    mockElementFromPoint(button);
    (window as any).__claudeElementMap.ref_1 = new WeakRef(button);
    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');

    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');
    await expect(
      callHelper(handler, {
        action: 'clickElement',
        ref: 'ref_1',
        snapshotId: 'missing-snapshot',
      }),
    ).resolves.toMatchObject({ error: expect.stringContaining('snapshot') });
    expect(click).not.toHaveBeenCalled();
  });

  it('rejects snapshot-scoped clicks when the observed target changes', async () => {
    const button = document.createElement('button');
    button.textContent = 'Continue';
    setRect(button);
    const click = vi.fn();
    button.addEventListener('click', click);
    document.body.append(button);
    mockElementFromPoint(button);

    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-1');
    button.textContent = 'Delete account';
    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        ref: snapshot.controls[0].ref,
        snapshotId: 'snapshot-1',
      }),
    ).resolves.toMatchObject({ error: expect.stringContaining('snapshot') });
    expect(click).not.toHaveBeenCalled();
  });

  it('rejects snapshot-scoped clicks after the observed node is replaced', async () => {
    const button = document.createElement('button');
    button.textContent = 'Continue';
    button.id = 'replace-target';
    setRect(button);
    const click = vi.fn();
    button.addEventListener('click', click);
    document.body.append(button);
    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-replaced');
    button.remove();
    const replacement = document.createElement('button');
    replacement.id = button.id;
    replacement.textContent = 'Continue';
    setRect(replacement);
    document.body.append(replacement);
    mockElementFromPoint(replacement);
    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'clickElement',
        ref: snapshot.controls[0].ref,
        snapshotId: 'snapshot-replaced',
      }),
    ).resolves.toMatchObject({ error: expect.stringContaining('changed') });
    expect(click).not.toHaveBeenCalled();
  });

  it('rejects a snapshot-scoped submit click when the owning form action changes', async () => {
    const form = document.createElement('form');
    form.action = '/safe-submit';
    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Continue';
    setRect(button);
    const click = vi.fn((event: Event) => event.preventDefault());
    button.addEventListener('click', click);
    form.append(button);
    document.body.append(form);
    mockElementFromPoint(button);

    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-form-action');
    form.action = '/changed-submit';
    const handler = loadInjectedHelper('click-helper.js', '__CLICK_HELPER_INITIALIZED__');
    await expect(
      callHelper(handler, {
        action: 'clickElement',
        ref: snapshot.controls[0].ref,
        snapshotId: 'snapshot-form-action',
      }),
    ).resolves.toMatchObject({ error: expect.stringContaining('changed') });
    expect(click).not.toHaveBeenCalled();
  });

  it('fills a snapshot-scoped editable field only while its observation is current', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Search');
    setRect(input);
    document.body.append(input);
    mockElementFromPoint(input);

    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-1');
    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'fillElement',
        ref: snapshot.controls[0].ref,
        snapshotId: 'snapshot-1',
        value: 'hello',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(input.value).toBe('hello');
  });

  it('does not fill when a snapshot-scoped target token is missing', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Search');
    setRect(input);
    document.body.append(input);
    mockElementFromPoint(input);
    (window as any).__claudeElementMap.ref_1 = new WeakRef(input);
    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'fillElement',
        ref: 'ref_1',
        snapshotId: 'missing-snapshot',
        value: 'must not be entered',
      }),
    ).resolves.toMatchObject({ error: expect.stringContaining('snapshot') });
    expect(input.value).toBe('');
  });

  it('rejects a snapshot-scoped fill if a visible text field becomes a password field', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Search');
    setRect(input);
    document.body.append(input);
    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-sensitive-change');
    input.type = 'password';
    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');

    await expect(
      callHelper(handler, {
        action: 'fillElement',
        ref: snapshot.controls[0].ref,
        snapshotId: 'snapshot-sensitive-change',
        value: 'must not be entered',
      }),
    ).resolves.toMatchObject({ error: expect.stringContaining('changed') });
    expect(input.value).toBe('');
  });

  it('waits briefly for options controlled by a snapshot-scoped combobox', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-label', 'Destination');
    input.setAttribute('aria-controls', 'suggestions');
    setRect(input);
    const suggestions = document.createElement('div');
    suggestions.id = 'suggestions';
    document.body.append(input, suggestions);
    mockElementFromPoint(input);
    input.addEventListener('input', () => {
      setTimeout(() => {
        const option = document.createElement('div');
        option.setAttribute('role', 'option');
        option.textContent = 'London';
        setRect(option);
        suggestions.append(option);
      }, 140);
    });

    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-1');
    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');
    const startedAt = Date.now();
    const result = await callHelper(handler, {
      action: 'fillElement',
      ref: snapshot.controls[0].ref,
      snapshotId: 'snapshot-1',
      value: 'Lon',
    });

    expect(result.success).toBe(true);
    expect(suggestions.querySelector('[role="option"]')?.textContent).toBe('London');
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it('keeps a snapshot-scoped combobox focused while waiting for options that close on blur', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-label', 'Destination');
    input.setAttribute('aria-controls', 'blur-sensitive-suggestions');
    setRect(input);
    const suggestions = document.createElement('div');
    suggestions.id = 'blur-sensitive-suggestions';
    input.addEventListener('input', () => {
      setTimeout(() => {
        const option = document.createElement('div');
        option.setAttribute('role', 'option');
        option.textContent = 'London';
        setRect(option);
        suggestions.append(option);
      }, 20);
    });
    input.addEventListener('blur', () => suggestions.replaceChildren());
    document.body.append(input, suggestions);
    mockElementFromPoint(input);

    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-blur-sensitive');
    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');
    await expect(
      callHelper(handler, {
        action: 'fillElement',
        ref: snapshot.controls[0].ref,
        snapshotId: 'snapshot-blur-sensitive',
        value: 'Lon',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(suggestions.querySelector('[role="option"]')?.textContent).toBe('London');
  });

  it('caps a snapshot-scoped combobox options wait at 200 ms', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-label', 'Destination');
    input.setAttribute('aria-controls', 'missing-suggestions');
    setRect(input);
    document.body.append(input);
    mockElementFromPoint(input);

    loadInjectedHelper('accessibility-tree-helper.js', '__ACCESSIBILITY_TREE_HELPER_INITIALIZED__');
    const snapshot = (window as any).__generateActionSnapshot('snapshot-1');
    const handler = loadInjectedHelper('fill-helper.js', '__FILL_HELPER_INITIALIZED__');
    const startedAt = Date.now();
    const result = await callHelper(handler, {
      action: 'fillElement',
      ref: snapshot.controls[0].ref,
      snapshotId: 'snapshot-1',
      value: 'Lon',
    });

    expect(result.success).toBe(true);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(270);
    expect(Date.now() - startedAt).toBeLessThan(450);
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
