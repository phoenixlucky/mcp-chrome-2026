/* eslint-disable */
// click-helper.js
// This script is injected into the page to handle click operations

if (window.__CLICK_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__CLICK_HELPER_INITIALIZED__ = true;
  /**
   * Click on an element matching the selector or at specific coordinates
   * @param {string} selector - CSS selector for the element to click
   * @param {boolean} waitForNavigation - Whether to wait for navigation to complete after click
   * @param {number} timeout - Timeout in milliseconds for waiting for the element or navigation
   * @param {Object} coordinates - Optional coordinates for clicking at a specific position
   * @param {number} coordinates.x - X coordinate relative to the viewport
   * @param {number} coordinates.y - Y coordinate relative to the viewport
   * @returns {Promise<Object>} - Result of the click operation
   */
  async function clickElement(
    selector,
    waitForNavigation = false,
    timeout = 5000,
    coordinates = null,
    ref = null,
    double = false,
    options = {},
  ) {
    try {
      const selectorType = options?.selectorType === 'xpath' ? 'xpath' : 'css';
      if (
        !ref &&
        !(
          coordinates &&
          typeof coordinates.x === 'number' &&
          Number.isFinite(coordinates.x) &&
          typeof coordinates.y === 'number' &&
          Number.isFinite(coordinates.y)
        ) &&
        (typeof selector !== 'string' || selector.trim().length === 0)
      ) {
        return {
          error: 'Click target is missing a valid selector, ref, or coordinates',
        };
      }

      let element = null;
      let elementInfo = null;
      let clickX, clickY;

      if (ref && typeof ref === 'string') {
        // Resolve element from weak map
        let target = null;
        try {
          const map = window.__claudeElementMap;
          const weak = map && map[ref];
          target = weak && typeof weak.deref === 'function' ? weak.deref() : null;
        } catch (e) {
          // ignore
        }

        if (!target || !(target instanceof Element)) {
          // A ref can expire after React re-renders. If the caller also sent
          // a selector, resolve the current element instead of failing early.
          if (selector) ref = null;
          else {
            return {
              error: `Element ref "${ref}" not found. Please call chrome_read_page first and ensure the ref is still valid.`,
            };
          }
        } else {
          element = target;
          element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
          await new Promise((resolve) => setTimeout(resolve, 80));

          const rect = element.getBoundingClientRect();
          clickX = rect.left + rect.width / 2;
          clickY = rect.top + rect.height / 2;
          elementInfo = {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            text: element.textContent?.trim().substring(0, 100) || '',
            href: element.href || null,
            type: element.type || null,
            isVisible: true,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
            },
            clickMethod: 'ref',
            ref,
          };
        }
      }
      if (
        !element &&
        coordinates &&
        typeof coordinates.x === 'number' &&
        typeof coordinates.y === 'number'
      ) {
        clickX = coordinates.x;
        clickY = coordinates.y;

        element = document.elementFromPoint(clickX, clickY);

        if (element) {
          const rect = element.getBoundingClientRect();
          elementInfo = {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            text: element.textContent?.trim().substring(0, 100) || '',
            href: element.href || null,
            type: element.type || null,
            isVisible: true,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
            },
            clickMethod: 'coordinates',
            clickPosition: { x: clickX, y: clickY },
          };
        } else {
          elementInfo = {
            clickMethod: 'coordinates',
            clickPosition: { x: clickX, y: clickY },
            warning: 'No element found at the specified coordinates',
          };
        }
      }
      if (!element && !coordinates) {
        const matches = querySelectorAllByType(selector, selectorType);
        element = await waitForVisibleElement(selector, timeout, selectorType);
        if (!element) {
          return {
            error: `Element with selector "${selector}" not found`,
          };
        }

        // Some sites put the actual click handler on a button while the
        // generated selector points at a descendant. Promote that descendant
        // to the nearest actionable control when possible.
        element = promoteToClickableElement(element);

        const rect = element.getBoundingClientRect();
        elementInfo = {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          text: element.textContent?.trim().substring(0, 100) || '',
          href: element.href || null,
          type: element.type || null,
          isVisible: isElementVisible(element),
          isHitTestVisible: isElementHitTestVisible(element),
          matchCount: matches.length,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          },
          clickMethod: 'selector',
        };

        // First sroll so that the element is in view, then check visibility.
        element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        await new Promise((resolve) => setTimeout(resolve, 100));
        elementInfo.isVisible = isElementVisible(element);
        elementInfo.isHitTestVisible = isElementHitTestVisible(element);
        if (!isElementActionable(element)) {
          return {
            error: `Element with selector "${selector}" is not actionable`,
            elementInfo,
          };
        }

        const updatedRect = element.getBoundingClientRect();
        clickX = updatedRect.left + updatedRect.width / 2;
        clickY = updatedRect.top + updatedRect.height / 2;
      }

      const disabledTarget =
        element?.closest?.('button, input, select, textarea, [role="button"]') || element;
      if (
        disabledTarget?.disabled === true ||
        disabledTarget?.getAttribute?.('aria-disabled') === 'true'
      ) {
        return {
          error: 'Target element is disabled',
          elementInfo,
        };
      }

      if (coordinates && !element) {
        return {
          error: 'No element found at the specified coordinates',
          elementInfo,
        };
      }

      let navigationPromise;
      if (waitForNavigation) {
        navigationPromise = new Promise((resolve) => {
          const beforeUnloadListener = () => {
            window.removeEventListener('beforeunload', beforeUnloadListener);
            resolve(true);
          };
          window.addEventListener('beforeunload', beforeUnloadListener);

          setTimeout(() => {
            window.removeEventListener('beforeunload', beforeUnloadListener);
            resolve(false);
          }, timeout);
        });
      }

      if (
        element &&
        (elementInfo.clickMethod === 'selector' || elementInfo.clickMethod === 'ref')
      ) {
        if (double) {
          dispatchClickSequence(element, clickX, clickY, options, true);
        } else {
          dispatchClickSequence(element, clickX, clickY, options, false);
        }
      } else {
        if (double) simulateDoubleClick(clickX, clickY, options);
        else simulateClick(clickX, clickY, options);
      }

      // Wait for navigation if needed
      let navigationOccurred = false;
      if (waitForNavigation) {
        navigationOccurred = await navigationPromise;
      }

      return {
        success: true,
        clicked: true,
        message: 'Element clicked successfully',
        elementInfo,
        navigationOccurred,
      };
    } catch (error) {
      return {
        error: `Error clicking element: ${error.message}`,
      };
    }
  }

  /**
   * Simulate a mouse click at specific coordinates
   * @param {number} x - X coordinate relative to the viewport
   * @param {number} y - Y coordinate relative to the viewport
   */
  function simulateClick(x, y, options = {}) {
    const element = document.elementFromPoint(x, y);
    if (!element) return;
    dispatchClickSequence(element, x, y, options, false);
  }

  /**
   * Simulate a double click sequence at specific coordinates
   */
  function simulateDoubleClick(x, y, options = {}) {
    const element = document.elementFromPoint(x, y);
    if (!element) return;
    dispatchClickSequence(element, x, y, options, true);
  }

  /**
   * Simulate double click using element when available
   */
  function simulateDomDoubleClick(element, x, y, options) {
    dispatchClickSequence(element, x, y, options, true);
  }

  function normalizeMouseOpts(x, y, options = {}) {
    const bubbles = options.bubbles !== false; // default true
    const cancelable = options.cancelable !== false; // default true
    const altKey = !!(options.modifiers && options.modifiers.altKey);
    const ctrlKey = !!(options.modifiers && options.modifiers.ctrlKey);
    const metaKey = !!(options.modifiers && options.modifiers.metaKey);
    const shiftKey = !!(options.modifiers && options.modifiers.shiftKey);
    const btn = String(options.button || 'left');
    const button = btn === 'right' ? 2 : btn === 'middle' ? 1 : 0;
    const buttons = btn === 'right' ? 2 : btn === 'middle' ? 4 : 1;
    return {
      bubbles,
      cancelable,
      altKey,
      ctrlKey,
      metaKey,
      shiftKey,
      button,
      buttons,
      clientX: x,
      clientY: y,
      view: window,
    };
  }

  function dispatchClickSequence(element, x, y, options = {}, isDouble = false) {
    const base = normalizeMouseOpts(x, y, options);
    // Synthetic mouse events do not perform the browser's default focus step.
    // Focus before dispatching so subsequent CDP keyboard/text input is routed
    // to the element the caller just clicked.
    try {
      if (typeof element.focus === 'function') element.focus({ preventScroll: true });
    } catch (_) {
      try {
        element.focus();
      } catch (_) {}
    }
    dispatchPressEvents(element, base);
    dispatchClickEvent(element, base);
    if (base.button === 2) {
      // right button contextmenu
      const ctx = new MouseEvent('contextmenu', base);
      try {
        element.dispatchEvent(ctx);
      } catch {}
    }
    if (isDouble) {
      // second sequence + dblclick
      setTimeout(() => {
        dispatchPressEvents(element, base);
        dispatchClickEvent(element, base);
        try {
          element.dispatchEvent(new MouseEvent('dblclick', base));
        } catch {}
      }, 30);
    }
  }

  /**
   * Dispatch the pointer and mouse press phases. The native click call below
   * is intentional: unlike dispatchEvent(new MouseEvent('click')), it also
   * performs default actions such as toggling a checkbox or opening a button.
   */
  function dispatchPressEvents(element, base) {
    const pointerBase = {
      ...base,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    };
    try {
      const PointerEventCtor = window.PointerEvent;
      if (typeof PointerEventCtor === 'function') {
        element.dispatchEvent(new PointerEventCtor('pointerdown', pointerBase));
      }
    } catch {}
    try {
      element.dispatchEvent(new MouseEvent('mousedown', base));
    } catch {}
    try {
      const PointerEventCtor = window.PointerEvent;
      if (typeof PointerEventCtor === 'function') {
        element.dispatchEvent(new PointerEventCtor('pointerup', pointerBase));
      }
    } catch {}
    try {
      element.dispatchEvent(new MouseEvent('mouseup', base));
    } catch {}
  }

  function dispatchClickEvent(element, base) {
    try {
      if (base.button === 0 && typeof element.click === 'function') {
        element.click();
        return;
      }
    } catch {}
    try {
      element.dispatchEvent(new MouseEvent('click', base));
    } catch {}
  }

  /**
   * Check if an element is visible
   * @param {Element} element - The element to check
   * @returns {boolean} - Whether the element is visible
   */
  function isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      return false;
    }

    return true;
  }

  function isElementHitTestVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    return !!elementAtPoint && (element === elementAtPoint || element.contains(elementAtPoint));
  }

  /**
   * A control can be visually hidden with opacity:0 and still be a valid
   * programmatic target. Keep display/visibility/size/disabled checks, but do
   * not require it to win hit-testing at its center point.
   */
  function isElementActionable(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const control =
      element.closest?.('button, input, select, textarea, [role="button"]') || element;
    return control.disabled !== true && control.getAttribute?.('aria-disabled') !== 'true';
  }

  function normalizeAriaLabel(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase();
  }

  function queryXPathAll(selector) {
    if (typeof selector !== 'string' || !selector.trim()) return [];
    try {
      const result = document.evaluate(
        selector,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );
      const matches = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node instanceof Element) matches.push(node);
      }
      return matches;
    } catch {
      return [];
    }
  }

  /**
   * CSS selectors containing non-ASCII aria-label values are valid CSS, but a
   * few pages/extensions produce selectors that fail intermittently. Retry
   * those selectors through the DOM attribute instead of relying on CSS
   * parsing alone.
   */
  function querySelectorAllRobust(selector) {
    let matches = [];
    try {
      matches = Array.from(document.querySelectorAll(selector));
    } catch {}
    if (matches.length > 0 || typeof selector !== 'string') return matches;

    const labelMatch = selector.match(
      /\[\s*aria-label\s*(=|\^=|\$=|\*=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*\]/i,
    );
    if (!labelMatch) return matches;
    const operator = labelMatch[1];
    const expected = normalizeAriaLabel(labelMatch[2] ?? labelMatch[3] ?? labelMatch[4]);
    const tagMatch = selector.match(/(?:^|[\s>+~])([a-z][a-z0-9-]*)\s*(?:\[|$)/gi);
    const expectedTag = tagMatch?.length
      ? tagMatch[tagMatch.length - 1].match(/[a-z][a-z0-9-]*/i)?.[0]?.toLowerCase()
      : undefined;
    return Array.from(document.querySelectorAll('[aria-label]')).filter((candidate) => {
      if (expectedTag && candidate.tagName.toLowerCase() !== expectedTag) return false;
      const actual = normalizeAriaLabel(candidate.getAttribute('aria-label'));
      if (operator === '^=') return actual.startsWith(expected);
      if (operator === '$=') return actual.endsWith(expected);
      if (operator === '*=') return actual.includes(expected);
      return actual === expected;
    });
  }

  function querySelectorAllByType(selector, selectorType = 'css') {
    return selectorType === 'xpath' ? queryXPathAll(selector) : querySelectorAllRobust(selector);
  }

  /**
   * Wait briefly for a selector to become visible. Dynamic pages often render
   * the target after the tool call has already started.
   */
  async function waitForVisibleElement(selector, timeout = 0, selectorType = 'css') {
    const waitMs = Number.isFinite(timeout) ? Math.min(Math.max(timeout, 0), 5000) : 5000;
    const deadline = Date.now() + waitMs;
    let firstMatch = null;

    do {
      const matches = querySelectorAllByType(selector, selectorType);
      if (!firstMatch && matches.length > 0) firstMatch = matches[0];
      const visible = matches.find(
        (candidate) =>
          isElementActionable(candidate) ||
          isElementActionable(candidate.closest?.('button, [role="button"], a, [data-testid]')),
      );
      if (visible) return visible;
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (true);

    return firstMatch;
  }

  /**
   * Use a visible interactive ancestor when a generated selector targets a
   * decorative or zero-sized child inside a button.
   */
  function promoteToClickableElement(element) {
    if (!element || typeof element.closest !== 'function') {
      return element;
    }

    if (element.matches?.('button, input, select, textarea, a, [role="button"]')) return element;

    const ancestor = element.closest('button, [role="button"], a, [data-testid]');
    return ancestor && isElementActionable(ancestor) ? ancestor : element;
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'clickElement') {
      clickElement(
        request.selector,
        request.waitForNavigation,
        request.timeout,
        request.coordinates,
        request.ref,
        !!request.double,
        {
          button: request.button,
          bubbles: request.bubbles,
          cancelable: request.cancelable,
          modifiers: request.modifiers,
        },
      )
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            error: `Unexpected error: ${error.message}`,
          });
        });
      return true; // Indicates async response
    } else if (request.action === 'chrome_click_element_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  });
}
