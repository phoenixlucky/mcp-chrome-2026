import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MarkerMessageHandler = (
  request: Record<string, unknown>,
  sender: unknown,
  respond: (response: unknown) => void,
) => boolean | void;

function startMarker(): ShadowRoot {
  const chromeApi = (globalThis as { chrome: any }).chrome;
  const listeners: MarkerMessageHandler[] = [];
  vi.spyOn(chromeApi.runtime.onMessage, 'addListener').mockImplementation((handler) => {
    listeners.push(handler as MarkerMessageHandler);
  });
  (window as any).chrome = chromeApi;
  delete (window as any).__ELEMENT_MARKER_INSTALLED__;
  window.eval(readFileSync(resolve(process.cwd(), 'inject-scripts/element-marker.js'), 'utf8'));
  listeners.at(-1)?.({ action: 'element_marker_start' }, {}, () => {});
  const shadow = document.querySelector('#__element_marker_overlay')?.shadowRoot;
  if (!shadow) throw new Error('Element marker did not mount');
  return shadow;
}

function click(element: Element, modifiers: MouseEventInit = {}): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...modifiers }));
}

function selectedElements(shadow: ShadowRoot): Element[] {
  const selector = shadow.querySelector('#__em_selector')?.textContent?.trim();
  if (!selector || selector === '-') return [];
  const type = (shadow.querySelector('#__em_selector_type') as HTMLSelectElement).value;
  if (type === 'xpath') {
    const snapshot = document.evaluate(
      selector,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    );
    return Array.from(
      { length: snapshot.snapshotLength },
      (_, index) => snapshot.snapshotItem(index) as Element,
    );
  }
  return Array.from(document.querySelectorAll(selector));
}

describe('element marker modifier selection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).CSS = {
      escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
    };
  });

  afterEach(() => {
    const close = document
      .querySelector('#__element_marker_overlay')
      ?.shadowRoot?.querySelector('#__em_close');
    if (close) click(close);
    vi.restoreAllMocks();
  });

  it('Ctrl-click selects arbitrary elements and saves a list selector matching only them', async () => {
    document.body.innerHTML =
      '<button id="first">First</button><a id="second">Second</a><button id="third">Third</button>';
    const shadow = startMarker();
    click(document.querySelector('#first')!);
    click(document.querySelector('#second')!, { ctrlKey: true });

    expect(selectedElements(shadow).map((element) => element.id)).toEqual(['first', 'second']);
    expect(shadow.querySelector('#__em_toggle_list')?.getAttribute('aria-pressed')).toBe('true');

    click(shadow.querySelector('#__em_save')!);
    await vi.waitFor(() => {
      expect((globalThis as { chrome: any }).chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'element_marker_save',
          marker: expect.objectContaining({ listMode: true }),
        }),
      );
    });
  });

  it('Ctrl-click toggles a selected element and ordinary click resets the selection', () => {
    document.body.innerHTML =
      '<button id="first">First</button><button id="second">Second</button><button id="third">Third</button>';
    const shadow = startMarker();
    click(document.querySelector('#first')!);
    click(document.querySelector('#second')!, { ctrlKey: true });
    click(document.querySelector('#second')!, { ctrlKey: true });
    expect(selectedElements(shadow).map((element) => element.id)).toEqual(['first']);

    click(document.querySelector('#third')!);
    expect(selectedElements(shadow).map((element) => element.id)).toEqual(['third']);
  });

  it('Shift-click selects corresponding elements in repeated rows', () => {
    document.body.innerHTML = `
      <section id="rows">
        <div><button id="one">Open</button><a id="help-one">Help</a></div>
        <div><button id="two">Open</button><a id="help-two">Help</a></div>
        <div><button id="three">Open</button><a id="help-three">Help</a></div>
      </section>`;
    const shadow = startMarker();
    click(document.querySelector('#two')!, { shiftKey: true });

    expect(selectedElements(shadow).map((element) => element.id)).toEqual(['one', 'two', 'three']);
    expect(shadow.querySelector('#__em_toggle_list')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('Ctrl-click produces an XPath union when XPath mode is selected', () => {
    document.body.innerHTML =
      '<button id="first">First</button><a id="second">Second</a><button id="third">Third</button>';
    const shadow = startMarker();
    const selectorType = shadow.querySelector('#__em_selector_type') as HTMLSelectElement;
    selectorType.value = 'xpath';
    selectorType.dispatchEvent(new Event('change', { bubbles: true }));
    click(document.querySelector('#first')!);
    click(document.querySelector('#second')!, { ctrlKey: true });

    expect(selectedElements(shadow).map((element) => element.id)).toEqual(['first', 'second']);
  });

  it('Ctrl+Space adds the hovered element to the keyboard selection', async () => {
    document.body.innerHTML =
      '<button id="first">First</button><button id="second">Second</button>';
    const shadow = startMarker();
    click(document.querySelector('#first')!);
    document
      .querySelector('#second')!
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(selectedElements(shadow).map((element) => element.id)).toEqual(['first', 'second']);
  });

  it('Ctrl-click keeps multiple selections inside an iframe', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const frameWindow = frame.contentWindow!;
    const frameDocument = frame.contentDocument!;
    frameDocument.body.innerHTML =
      '<button id="first">First</button><button id="second">Second</button>';
    (frameWindow as any).chrome = (globalThis as { chrome: any }).chrome;
    (frameWindow as any).CSS = (window as any).CSS;
    const listeners: MarkerMessageHandler[] = [];
    vi.spyOn(
      (globalThis as { chrome: any }).chrome.runtime.onMessage,
      'addListener',
    ).mockImplementation((handler) => listeners.push(handler as MarkerMessageHandler));
    const postMessage = vi.spyOn(frameWindow.top!, 'postMessage').mockImplementation(() => {});
    (frameWindow as any).eval(
      readFileSync(resolve(process.cwd(), 'inject-scripts/element-marker.js'), 'utf8'),
    );
    expect((frameWindow as any).__ELEMENT_MARKER_INSTALLED__).toBe(true);
    listeners.at(-1)?.({ action: 'element_marker_start' }, {}, () => {});

    click(frameDocument.querySelector('#first')!);
    click(frameDocument.querySelector('#second')!, { ctrlKey: true });

    const message = postMessage.mock.lastCall?.[0] as {
      selectionMode: string;
      members: Array<{ selector: string }>;
    };
    expect(message.selectionMode).toBe('manual');
    expect(
      message.members.map((member) => frameDocument.querySelector(member.selector)?.id),
    ).toEqual(['first', 'second']);
  });

  it('Ctrl+Space reports iframe multi-selection to the main panel', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const child = frame.contentWindow!;
    child.document.body.innerHTML =
      '<button id="first">First</button><button id="second">Second</button>';
    (child as any).chrome = (globalThis as { chrome: any }).chrome;
    (child as any).CSS = (window as any).CSS;
    const listeners: MarkerMessageHandler[] = [];
    vi.spyOn(
      (globalThis as { chrome: any }).chrome.runtime.onMessage,
      'addListener',
    ).mockImplementation((handler) => listeners.push(handler as MarkerMessageHandler));
    const postMessage = vi.spyOn(child.top!, 'postMessage').mockImplementation(() => {});
    (child as any).eval(
      readFileSync(resolve(process.cwd(), 'inject-scripts/element-marker.js'), 'utf8'),
    );
    listeners.at(-1)?.({ action: 'element_marker_start' }, {}, () => {});

    click(child.document.querySelector('#first')!);
    postMessage.mockClear();
    child.document
      .querySelector('#second')!
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await new Promise((resolve) => child.requestAnimationFrame(resolve));
    child.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    const message = postMessage.mock.lastCall?.[0] as {
      selectionMode: string;
      members: Array<{ selector: string }>;
    };
    expect(message.selectionMode).toBe('manual');
    expect(
      message.members.map((member) => child.document.querySelector(member.selector)?.id),
    ).toEqual(['first', 'second']);
  });

  it('clears an iframe selection when Ctrl removes its last element', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const shadow = startMarker();
    const fromFrame = (innerSel: string) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'em_selection_update',
            selectionMode: 'manual',
            members: innerSel ? [{ selector: innerSel, name: 'First', selectorType: 'css' }] : [],
          },
          source: frame.contentWindow,
        }),
      );

    fromFrame('#first');
    expect(shadow.querySelector('#__em_selector')?.textContent).toContain('#first');
    fromFrame('');
    expect(shadow.querySelector('#__em_selector')?.textContent).toBe('-');
  });

  it('prevents native text range selection while Shift-selecting page elements', () => {
    document.body.innerHTML = '<button id="first">First</button>';
    startMarker();
    const mouseDown = new MouseEvent('mousedown', {
      shiftKey: true,
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector('#first')!.dispatchEvent(mouseDown);

    expect(mouseDown.defaultPrevented).toBe(true);
  });

  it('does not leave automatic list mode enabled after reopening the marker', () => {
    document.body.innerHTML =
      '<div><button id="one">One</button></div><div><button id="two">Two</button></div>';
    const shadow = startMarker();
    click(document.querySelector('#two')!, { shiftKey: true });
    click(shadow.querySelector('#__em_close')!);

    const listener = vi
      .mocked((globalThis as { chrome: any }).chrome.runtime.onMessage.addListener)
      .mock.calls.at(-1)?.[0] as MarkerMessageHandler;
    listener({ action: 'element_marker_start' }, {}, () => {});
    const reopened = document.querySelector('#__element_marker_overlay')!.shadowRoot!;
    click(document.querySelector('#two')!);

    expect(selectedElements(reopened).map((element) => element.id)).toEqual(['two']);
  });

  it('ordinary main-frame click resets automatic list mode after iframe multi-select', () => {
    document.body.innerHTML =
      '<iframe></iframe><div><button id="one">One</button></div><div><button id="two">Two</button></div>';
    const shadow = startMarker();
    const frame = document.querySelector('iframe')!;
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'em_click', innerSel: '#one, #two', listMode: true },
        source: frame.contentWindow,
      }),
    );
    click(document.querySelector('#two')!);

    expect(selectedElements(shadow).map((element) => element.id)).toEqual(['two']);
  });
});
