/**
 * DOM Path - DOM path computation and location
 *
 * A DOM path is the index path of an element in the DOM tree, used for:
 * - Element position tracking
 * - Fast recovery after a selector stops working
 * - Element comparison and verification
 */

// =============================================================================
// Types
// =============================================================================

/**
 * DOM path: child index array from the root to the target element
 *
 * @example
 * ```
 * [0, 2, 1] means:
 * root
 *  └─ children[0]
 *      └─ children[2]
 *          └─ children[1]  <- target element
 * ```
 */
export type DomPath = number[];

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Compute the element's path in the DOM tree
 *
 * Walks up from the target element to the root node (Document or ShadowRoot),
 * recording each level's index within its parent's children.
 *
 * @example
 * ```ts
 * const path = computeDomPath(button);
 * // => [0, 2, 1] - path starting from body/shadowRoot
 * ```
 */
export function computeDomPath(element: Element): DomPath {
  const path: DomPath = [];
  let current: Element | null = element;

  while (current) {
    const parent: Element | null = current.parentElement;

    if (parent) {
      // Normal parent element
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current);
      if (index >= 0) {
        path.unshift(index);
      }
      current = parent;
      continue;
    }

    // Check whether this is a direct child of ShadowRoot or Document
    const parentNode = current.parentNode;
    if (parentNode instanceof ShadowRoot || parentNode instanceof Document) {
      const children = Array.from(parentNode.children);
      const index = children.indexOf(current);
      if (index >= 0) {
        path.unshift(index);
      }
    }

    // Reached the root node, stop walking
    break;
  }

  return path;
}

/**
 * Locate an element from a DOM path
 *
 * @param root - Query root node (Document or ShadowRoot)
 * @param path - DOM path
 * @returns The found element, or null if the path is invalid
 *
 * @example
 * ```ts
 * const element = locateByDomPath(document, [0, 2, 1]);
 * // => returns body > children[0] > children[2] > children[1]
 * ```
 */
export function locateByDomPath(root: Document | ShadowRoot, path: DomPath): Element | null {
  if (path.length === 0) {
    return null;
  }

  let current: Element | null = root.children[path[0]] ?? null;

  for (let i = 1; i < path.length && current; i++) {
    const index = path[i];
    current = current.children[index] ?? null;
  }

  return current;
}

/**
 * Compare two DOM paths
 *
 * @returns Result containing whether they are the same and the common prefix length
 *
 * @example
 * ```ts
 * const result = compareDomPaths([0, 2, 1], [0, 2, 3]);
 * // => { same: false, commonPrefixLength: 2 }
 * ```
 */
export function compareDomPaths(
  a: DomPath,
  b: DomPath,
): { same: boolean; commonPrefixLength: number } {
  const minLen = Math.min(a.length, b.length);
  let commonPrefixLength = 0;

  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      commonPrefixLength++;
    } else {
      break;
    }
  }

  const same = a.length === b.length && commonPrefixLength === a.length;

  return { same, commonPrefixLength };
}

/**
 * Check whether path A is an ancestor of path B
 *
 * @example
 * ```ts
 * isAncestorPath([0, 2], [0, 2, 1]); // true
 * isAncestorPath([0, 2, 1], [0, 2]); // false
 * ```
 */
export function isAncestorPath(ancestor: DomPath, descendant: DomPath): boolean {
  if (ancestor.length >= descendant.length) {
    return false;
  }

  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Get the relative path from an ancestor path to a descendant path
 *
 * @example
 * ```ts
 * getRelativePath([0, 2], [0, 2, 1, 3]); // [1, 3]
 * ```
 */
export function getRelativePath(ancestor: DomPath, descendant: DomPath): DomPath | null {
  if (!isAncestorPath(ancestor, descendant)) {
    return null;
  }

  return descendant.slice(ancestor.length);
}
