/* eslint-disable */
// fill-helper.js
// This script is injected into the page to handle form filling operations

if (window.__FILL_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__FILL_HELPER_INITIALIZED__ = true;
  /**
   * Fill an input element with the specified value
   * @param {string} selector - CSS selector for the element to fill
   * @param {string} value - Value to fill into the element
   * @returns {Promise<Object>} - Result of the fill operation
   */
  function isContentEditableElement(element) {
    if (!element || !(element instanceof Element)) return false;
    if (element.isContentEditable === true) return true;
    const attribute = element.getAttribute('contenteditable');
    return attribute !== null && attribute.toLowerCase() !== 'false';
  }

  function normalizeEditableText(value) {
    return String(value ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function readElementValue(element) {
    if (element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      return String(element.value ?? '');
    }
    return String(element?.innerText ?? element?.textContent ?? '');
  }

  function dispatchInput(element, value, inputType = 'insertText') {
    try {
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType,
          data: value,
        }),
      );
    } catch (_) {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function setNativeValue(element, value) {
    const prototype =
      element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }

  function findVisibleElement(selector) {
    try {
      const matches = Array.from(document.querySelectorAll(selector));
      // Prefer a currently visible match, but keep an off-viewport renderable
      // match so fillElement can scroll it into view before the final check.
      return (
        matches.find((candidate) => isElementVisible(candidate)) ||
        matches.find((candidate) => isElementRenderable(candidate)) ||
        matches[0] ||
        null
      );
    } catch (_) {
      return null;
    }
  }

  async function fillElement(selector, value, ref = null) {
    try {
      // Find the element
      let element = null;
      if (ref && typeof ref === 'string') {
        try {
          const map = window.__claudeElementMap;
          const weak = map && map[ref];
          element = weak && typeof weak.deref === 'function' ? weak.deref() : null;
        } catch (e) {
          // ignore
        }
        if (!element || !(element instanceof Element)) {
          // React re-renders can invalidate a ref between read_page and fill.
          // When a selector is available, resolve the current element instead.
          element = selector ? findVisibleElement(selector) : null;
          if (!element) {
            return {
              error: `Element ref "${ref}" not found. Please call chrome_read_page first and ensure the ref is still valid.`,
            };
          }
        }
      } else {
        element = findVisibleElement(selector);
      }
      if (!element) {
        return {
          error: selector
            ? `Element with selector "${selector}" not found`
            : `Element for ref not found`,
        };
      }

      // Bring off-viewport controls into view before checking hit-test
      // visibility. This matters for search inputs rendered outside the
      // current viewport by dynamic pages.
      if (!isElementVisible(element) && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Get element information
      const rect = element.getBoundingClientRect();
      const elementInfo = {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        type: element.type || null,
        isVisible: isElementVisible(element),
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
      };

      // Check if element is visible
      if (!elementInfo.isVisible) {
        return {
          error: `Element with selector "${selector}" is not visible`,
          elementInfo,
        };
      }

      // Check if element is an input, textarea, select, or contenteditable editor.
      const validTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      // Keep a permissive list to allow type-specific branches below to handle behavior
      const validInputTypes = [
        'text',
        'email',
        'password',
        'number',
        'search',
        'tel',
        'url',
        'date',
        'datetime-local',
        'month',
        'time',
        'week',
        'color',
        'checkbox',
        'radio',
        'range',
      ];

      const contentEditable = isContentEditableElement(element);
      if (!validTags.includes(element.tagName) && !contentEditable) {
        // If the element is a custom element with open shadow root, try to find a fillable inner control
        try {
          const anyEl = /** @type {any} */ (element);
          const sr = anyEl && anyEl.shadowRoot ? anyEl.shadowRoot : null;
          if (sr) {
            // Search common fillable targets inside shadow root (breadth-first)
            const queue = Array.from(sr.children || []);
            const isFillable = (el) =>
              !!el &&
              (el.tagName === 'INPUT' ||
                el.tagName === 'TEXTAREA' ||
                el.tagName === 'SELECT' ||
                isContentEditableElement(el));
            while (queue.length) {
              const cur = queue.shift();
              if (!cur) continue;
              if (isFillable(cur)) {
                element = cur;
                break;
              }
              try {
                const children = cur.children || [];
                for (let i = 0; i < children.length; i++) queue.push(children[i]);
                const innerSr = /** @type {any} */ (cur).shadowRoot;
                if (innerSr && innerSr.children) {
                  for (let i = 0; i < innerSr.children.length; i++) queue.push(innerSr.children[i]);
                }
              } catch (_) {}
            }
            if (!validTags.includes(element.tagName) && !isContentEditableElement(element)) {
              return {
                error: `Element with selector "${selector}" is not a fillable element (must be INPUT, TEXTAREA, SELECT, or contenteditable)`,
                elementInfo,
              };
            }
          } else {
            return {
              error: `Element with selector "${selector}" is not a fillable element (must be INPUT, TEXTAREA, SELECT, or contenteditable)`,
              elementInfo,
            };
          }
        } catch (_) {
          return {
            error: `Element with selector "${selector}" is not a fillable element (must be INPUT, TEXTAREA, SELECT, or contenteditable)`,
            elementInfo,
          };
        }
      }

      // For input elements, check if the type is valid (allow type-specific branches below)
      if (
        element.tagName === 'INPUT' &&
        !validInputTypes.includes(element.type) &&
        element.type !== null
      ) {
        return {
          error: `Input element with selector "${selector}" has type "${element.type}" which is not fillable`,
          elementInfo,
        };
      }

      // Scroll element into view
      element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Focus the element
      element.focus();

      if (isContentEditableElement(element)) {
        const textValue = String(value ?? '');
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection?.removeAllRanges();
        selection?.addRange(range);

        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, textValue);
        } catch (_) {
          inserted = false;
        }

        if (!inserted) {
          element.textContent = textValue;
          dispatchInput(element, textValue);
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));

        const actualValue = readElementValue(element);
        element.blur();
        if (normalizeEditableText(actualValue) !== normalizeEditableText(textValue)) {
          return {
            error: `Contenteditable value verification failed: expected "${textValue}", got "${actualValue}"`,
            elementInfo: { ...elementInfo, value: actualValue, contentEditable: true },
          };
        }
        return {
          success: true,
          message: 'Contenteditable element filled and verified successfully',
          elementInfo: { ...elementInfo, value: actualValue, contentEditable: true },
        };
      }

      // Type-specific handling for tricky inputs first
      if (element.tagName === 'INPUT' && element.type === 'checkbox') {
        // Accept boolean or string-like boolean
        let checkedVal;
        if (typeof value === 'boolean') {
          checkedVal = value;
        } else if (typeof value === 'string') {
          const v = value.trim().toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(v)) checkedVal = true;
          else if (['false', '0', 'no', 'off'].includes(v)) checkedVal = false;
        }
        if (typeof checkedVal !== 'boolean') {
          return {
            error:
              'Checkbox requires a boolean (true/false) or a boolean-like string ("true"/"false"/"on"/"off").',
            elementInfo,
          };
        }
        const previous = element.checked;
        element.checked = checkedVal;
        element.focus();
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
        return {
          success: true,
          message: `Checkbox set to ${element.checked}`,
          elementInfo: { ...elementInfo, checked: element.checked, previousChecked: previous },
        };
      }

      if (element.tagName === 'INPUT' && element.type === 'radio') {
        // For radios, the selector/ref should target the specific input to select
        const previous = element.checked;
        element.checked = true;
        element.focus();
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
        return {
          success: true,
          message: 'Radio selected',
          elementInfo: {
            ...elementInfo,
            checked: element.checked,
            previousChecked: previous,
            name: element.name || null,
          },
        };
      }

      if (element.tagName === 'INPUT' && element.type === 'range') {
        const numericValue = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(numericValue)) {
          return { error: 'Range input requires a numeric value', elementInfo };
        }
        const previous = element.value;
        element.value = String(numericValue);
        element.focus();
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
        return {
          success: true,
          message: `Set range to ${element.value} (min: ${element.min}, max: ${element.max})`,
          elementInfo: { ...elementInfo, value: element.value },
        };
      }

      if (element.tagName === 'INPUT' && element.type === 'number') {
        if (value !== '' && value !== null && value !== undefined && Number.isNaN(Number(value))) {
          return { error: 'Number input requires a numeric value', elementInfo };
        }
        const previous = element.value;
        element.value = String(value ?? '');
        element.focus();
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
        return {
          success: true,
          message: `Set number input to ${element.value} (previous: ${previous})`,
          elementInfo: { ...elementInfo, value: element.value },
        };
      }

      // Fill the element based on its type
      if (element.tagName === 'SELECT') {
        // For select elements, find the option with matching value or text
        let optionFound = false;
        for (const option of element.options) {
          if (option.value === value || option.text === value) {
            element.value = option.value;
            optionFound = true;
            break;
          }
        }

        if (!optionFound) {
          return {
            error: `No option with value or text "${value}" found in select element`,
            elementInfo,
          };
        }

        // Trigger change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // For input and textarea elements
        // Clear the current value then set new value
        setNativeValue(element, '');
        dispatchInput(element, '', 'deleteContentBackward');

        setNativeValue(element, String(value));

        dispatchInput(element, String(value));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Blur the element
      element.blur();

      // Read back the property after the input/change events. This catches
      // controlled components that reject a synthetic value assignment.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const actualValue = readElementValue(element);
      const expectedValue = String(value ?? '');
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (actualValue !== expectedValue) {
          return {
            error: `Element value verification failed: expected "${expectedValue}", got "${actualValue}"`,
            elementInfo: { ...elementInfo, value: actualValue, verified: false },
          };
        }
      }

      return {
        success: true,
        message: 'Element filled and verified successfully',
        elementInfo: {
          ...elementInfo,
          value: actualValue,
          verified: true,
        },
      };
    } catch (error) {
      return {
        error: `Error filling element: ${error.message}`,
      };
    }
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

    // Check if element is within viewport
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      return false;
    }

    // Check if element is actually visible at its center point
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    if (!elementAtPoint) return false;

    return element === elementAtPoint || element.contains(elementAtPoint);
  }

  /**
   * Check whether an element can be rendered, without requiring it to be in
   * the current viewport. Used to select an offscreen candidate before scroll.
   */
  function isElementRenderable(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'fillElement') {
      fillElement(request.selector, request.value, request.ref)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            error: `Unexpected error: ${error.message}`,
          });
        });
      return true; // Indicates async response
    } else if (request.action === 'chrome_fill_or_select_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  });
}
