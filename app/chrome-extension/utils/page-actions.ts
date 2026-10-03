import { CONTEXT_ACTION_MESSAGE_TYPES } from '@/common/message-types';

const STYLE_IDS = {
  animations: '__context_action_disable_animations',
  images: '__context_action_hide_images',
} as const;

let colorPickerCleanup: (() => void) | null = null;
let borderCleanup: (() => void) | null = null;

type PageActionResult = { success: boolean; count?: number; enabled?: boolean; error?: string };

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number.parseFloat(style.opacity || '1') > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function isExtensionElement(element: Element | null): boolean {
  if (!(element instanceof Element)) return false;
  return Boolean(element.id?.startsWith('__') || element.closest('[id^="__"]'));
}

function showToast(message: string, isError = false): void {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'left:50%',
    'top:24px',
    'transform:translateX(-50%)',
    'max-width:min(80vw,520px)',
    'padding:10px 16px',
    'border-radius:8px',
    'background:' + (isError ? '#b42318' : '#1f2937'),
    'color:#fff',
    'font:14px/1.4 sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,.25)',
  ].join(';');
  document.documentElement.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2400);
}

async function copyText(text: string): Promise<{ success: boolean; error?: string }> {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied
      ? { success: true }
      : { success: false, error: 'The browser denied clipboard access.' };
  }
}

function smartClosePopups(): number {
  const popupSelector = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[id*="cookie" i]',
    '[class*="cookie" i]',
    '[id*="consent" i]',
    '[class*="consent" i]',
    '[id*="popup" i]',
    '[class*="popup" i]',
    '[id*="modal" i]',
    '[class*="modal" i]',
    '[id*="advert" i]',
    '[class*="advert" i]',
    '[id*="banner" i]',
    '[class*="banner" i]',
  ].join(',');
  const strongWords = /cookie|consent|privacy|advert|popup|subscribe|newsletter|banner/i;
  const closeWords = /close|dismiss|reject|accept|cancel|later|no thanks|got it/i;
  let count = 0;

  for (const popup of Array.from(document.querySelectorAll(popupSelector))) {
    if (isExtensionElement(popup) || !isVisible(popup)) continue;
    const style = window.getComputedStyle(popup);
    const text = `${popup.id} ${popup.className} ${popup.textContent || ''}`.slice(0, 1200);
    const fixed =
      style.position === 'fixed' ||
      style.position === 'sticky' ||
      popup.matches('[role="dialog"], [aria-modal="true"]');
    if (!fixed || !strongWords.test(text)) continue;

    const button = Array.from(
      popup.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"], a',
      ),
    ).find((candidate) =>
      closeWords.test(
        `${candidate.textContent || ''} ${candidate.getAttribute('aria-label') || ''} ${candidate.getAttribute('title') || ''}`,
      ),
    );
    if (button instanceof HTMLElement) {
      button.click();
      count += 1;
    } else if (popup !== document.body && popup.parentElement) {
      popup.remove();
      count += 1;
    }
  }
  return count;
}

function restorePageScroll(): void {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  for (const target of [document.documentElement, document.body]) {
    const computed = window.getComputedStyle(target);
    if (
      computed.overflow === 'hidden' ||
      computed.overflowY === 'hidden' ||
      computed.position === 'fixed'
    ) {
      target.style.setProperty('overflow', 'auto', 'important');
      target.style.setProperty('overflow-x', 'auto', 'important');
      target.style.setProperty('overflow-y', 'auto', 'important');
      target.style.setProperty('height', 'auto', 'important');
      target.style.setProperty('max-height', 'none', 'important');
      target.style.setProperty('touch-action', 'auto', 'important');
    }
    if (computed.position === 'fixed') {
      target.style.setProperty('position', 'static', 'important');
      target.style.removeProperty('top');
      target.style.removeProperty('left');
      target.style.removeProperty('right');
      target.style.removeProperty('width');
    }
    target.classList.remove(
      'modal-open',
      'no-scroll',
      'noscroll',
      'scroll-locked',
      'overflow-hidden',
    );
  }
  window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
}

function toggleStyle(id: string, cssText: string): boolean {
  const current = document.getElementById(id);
  if (current) {
    current.remove();
    return false;
  }
  const style = document.createElement('style');
  style.id = id;
  style.textContent = cssText;
  (document.head || document.documentElement).appendChild(style);
  return true;
}

function expandCollapsedContent(): number {
  let count = 0;
  document.querySelectorAll('details:not([open])').forEach((element) => {
    element.setAttribute('open', '');
    count += 1;
  });
  document.querySelectorAll('[aria-expanded="false"][aria-controls]').forEach((element) => {
    if (isExtensionElement(element)) return;
    if (
      element instanceof HTMLElement &&
      (element.matches('button, [role="button"], summary') || element.hasAttribute('data-toggle'))
    ) {
      element.click();
    }
    element.setAttribute('aria-expanded', 'true');
    const controlId = element.getAttribute('aria-controls');
    if (controlId) document.getElementById(controlId)?.removeAttribute('hidden');
    count += 1;
  });
  return count;
}

function focusFirstInput(): boolean {
  const target = Array.from(
    document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement
    >('input:not([type="hidden"]), textarea, select, [contenteditable="true"]'),
  ).find((element) => {
    if (isExtensionElement(element) || !isVisible(element)) return false;
    return (
      !(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) ||
      !element.disabled
    );
  });
  if (!target) return false;
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  target.focus({ preventScroll: true });
  return true;
}

function fieldHint(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const label = element.closest('label')?.textContent || '';
  return `${element.type || ''} ${element.name || ''} ${element.id || ''} ${element.getAttribute('placeholder') || ''} ${element.getAttribute('aria-label') || ''} ${label}`.toLowerCase();
}

function testValueForField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string {
  const hint = fieldHint(element);
  const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : '';
  if (type === 'email' || /email|mail/.test(hint)) return 'test.user@example.com';
  if (type === 'tel' || /phone|tel|mobile/.test(hint)) return '13800138000';
  if (type === 'url' || /url|website|link/.test(hint)) return 'https://example.com';
  if (type === 'date' || /date|birth/.test(hint)) return '2026-01-01';
  if (type === 'number' || /number|amount|price|age|quantity/.test(hint)) return '1';
  if (/address/.test(hint)) return '1 Test Road';
  if (/name|user/.test(hint)) return 'Test User';
  return 'Test Content';
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
}

function fillEmptyTestData(): number {
  let count = 0;
  const fields = document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, select',
  );
  fields.forEach((field) => {
    if (
      isExtensionElement(field) ||
      !isVisible(field) ||
      field.disabled ||
      ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
        field.readOnly)
    )
      return;
    if (field instanceof HTMLSelectElement) {
      if (field.value) return;
      const option = Array.from(field.options).find((item) => item.value);
      if (!option) return;
      field.value = option.value;
    } else {
      if (field.value.trim()) return;
      setNativeValue(field, testValueForField(field));
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    count += 1;
  });
  document.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach((field) => {
    if (isExtensionElement(field) || !isVisible(field) || field.textContent?.trim()) return;
    field.textContent = 'Test Content';
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    count += 1;
  });
  return count;
}

function elementLabel(element: Element): string {
  const html = element as HTMLElement;
  return (
    html.getAttribute('aria-label') ||
    html.getAttribute('name') ||
    html.getAttribute('placeholder') ||
    html.id ||
    html.tagName.toLowerCase()
  )
    .replace(/\s+/g, ' ')
    .slice(0, 32);
}

function toggleElementBorders(): boolean {
  if (borderCleanup) {
    borderCleanup();
    borderCleanup = null;
    return false;
  }
  const layer = document.createElement('div');
  layer.id = '__context_action_element_borders';
  layer.style.cssText =
    'position:fixed;inset:0;z-index:2147483645;pointer-events:none;overflow:hidden;';
  document.documentElement.appendChild(layer);
  const render = () => {
    layer.replaceChildren();
    const candidates = Array.from(document.querySelectorAll('body *'))
      .filter((element) => !isExtensionElement(element) && isVisible(element))
      .slice(0, 500);
    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth)
        continue;
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border:1px solid rgba(14,116,144,.55);box-sizing:border-box;`;
      const label = document.createElement('span');
      label.textContent = elementLabel(element);
      label.style.cssText =
        'position:absolute;left:-1px;top:-16px;padding:1px 3px;background:#0e7490;color:#fff;font:10px/14px sans-serif;white-space:nowrap;';
      box.appendChild(label);
      layer.appendChild(box);
    }
  };
  const schedule = () => requestAnimationFrame(render);
  addEventListener('scroll', schedule, true);
  addEventListener('resize', schedule);
  render();
  borderCleanup = () => {
    removeEventListener('scroll', schedule, true);
    removeEventListener('resize', schedule);
    layer.remove();
  };
  return true;
}

function colorToHex(color: string): string | null {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!match || (match[4] !== undefined && Number(match[4]) === 0)) return null;
  return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

function startColorPicker(): void {
  colorPickerCleanup?.();
  const previousCursor = document.documentElement.style.cursor;
  document.documentElement.style.cursor = 'crosshair';
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') finish();
  };
  const onClick = (event: MouseEvent) => {
    const target =
      event.target instanceof Element
        ? event.target
        : document.elementFromPoint(event.clientX, event.clientY);
    if (!(target instanceof Element) || isExtensionElement(target)) return;
    event.preventDefault();
    event.stopPropagation();
    const style = getComputedStyle(target);
    const hex = [style.backgroundColor, style.color, style.borderTopColor]
      .map(colorToHex)
      .find(Boolean);
    finish();
    if (!hex) {
      showToast('No valid color found', true);
      return;
    }
    void copyText(hex).then((result) =>
      showToast(
        result.success ? `Copied color ${hex}` : result.error || 'Failed to copy color',
        !result.success,
      ),
    );
  };
  const finish = () => {
    document.documentElement.style.cursor = previousCursor;
    removeEventListener('click', onClick, true);
    removeEventListener('keydown', onKey, true);
    colorPickerCleanup = null;
  };
  addEventListener('click', onClick, true);
  addEventListener('keydown', onKey, true);
  colorPickerCleanup = finish;
  showToast('Color picker enabled; click a page element to pick its color. Press Esc to cancel');
}

export async function handlePageAction(action: string): Promise<PageActionResult> {
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.SMART_CLOSE_POPUPS) {
    const count = smartClosePopups();
    showToast(count ? `Handled ${count} popups` : 'No safely closable popups found', !count);
    return { success: true, count };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.RESTORE_PAGE_SCROLL) {
    restorePageScroll();
    showToast('Page scroll restored');
    return { success: true };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_ANIMATIONS) {
    const enabled = toggleStyle(
      STYLE_IDS.animations,
      '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;}',
    );
    showToast(enabled ? 'Page animations disabled' : 'Page animations restored');
    return { success: true, enabled };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.EXPAND_COLLAPSED_CONTENT) {
    const count = expandCollapsedContent();
    showToast(count ? `Expanded ${count} collapsed items` : 'No expandable content found', !count);
    return { success: true, count };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.FOCUS_FIRST_INPUT) {
    const success = focusFirstInput();
    showToast(success ? 'Focused the first input' : 'No usable input found', !success);
    return { success };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.FILL_EMPTY_TEST_DATA) {
    const count = fillEmptyTestData();
    showToast(count ? `Filled ${count} empty fields` : 'No fillable empty fields found', !count);
    return { success: true, count };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_ELEMENT_BORDERS) {
    const enabled = toggleElementBorders();
    showToast(enabled ? 'Element borders shown' : 'Element borders hidden');
    return { success: true, enabled };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.START_COLOR_PICKER) {
    startColorPicker();
    return { success: true };
  }
  if (action === CONTEXT_ACTION_MESSAGE_TYPES.TOGGLE_PAGE_IMAGES) {
    const enabled = toggleStyle(
      STYLE_IDS.images,
      'img,picture,svg,video,[role="img"]{visibility:hidden!important;}*{background-image:none!important;}',
    );
    showToast(enabled ? 'Page images hidden' : 'Page images shown');
    return { success: true, enabled };
  }
  return { success: false, error: 'Unknown page action' };
}
