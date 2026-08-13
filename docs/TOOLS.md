# Chrome MCP Server API Reference 📚

Complete reference for all available tools and their parameters.

## 📋 Table of Contents

- [Browser Management](#browser-management)
- [Screenshots & Visual](#screenshots--visual)
- [Network Monitoring](#network-monitoring)
- [Content Analysis](#content-analysis)
- [Interaction](#interaction)
- [Data Management](#data-management) (includes Cookie Management)
- [Scraping & Extraction](#scraping--extraction)
- [Response Format](#response-format)

## 📊 Browser Management

### `get_windows_and_tabs` (Launched: 2025-06-09)

List all currently open browser windows and tabs.

**Parameters**: None

**Response**:

```json
{
  "windowCount": 2,
  "tabCount": 5,
  "windows": [
    {
      "windowId": 123,
      "tabs": [
        {
          "tabId": 456,
          "url": "https://example.com",
          "title": "Example Page",
          "active": true
        }
      ]
    }
  ]
}
```

### `chrome_navigate` (Launched: 2025-06-09)

Navigate to a URL with optional viewport control.

**Parameters**:

- `url` (string, optional): URL to navigate to (omit when `refresh=true`)
- `newWindow` (boolean, optional): Create new window (default: false)
- `tabId` (number, optional): Target an existing tab by ID (navigate/refresh that tab)
- `background` (boolean, optional): Do not activate the tab or focus the window (default: true; set `false` for foreground interaction)
- `width` (number, optional): Viewport width in pixels (default: 1280)
- `height` (number, optional): Viewport height in pixels (default: 720)

**Example**:

```json
{
  "url": "https://example.com",
  "newWindow": true,
  "width": 1920,
  "height": 1080
}
```

### `chrome_close_tabs` (Launched: 2025-06-09)

Close specific tabs or windows.

**Parameters**:

- `tabIds` (array, optional): Array of tab IDs to close
- `windowIds` (array, optional): Array of window IDs to close

**Example**:

```json
{
  "tabIds": [123, 456],
  "windowIds": [789]
}
```

### `chrome_switch_tab` (Launched: 2025-07-24)

Switch to a specific browser tab.

**Parameters**:

- `tabId` (number, required): The ID of the tab to switch to.
- `windowId` (number, optional): The ID of the window where the tab is located.

**Example**:

```json
{
  "tabId": 456,
  "windowId": 123
}
```

### `chrome_go_back_or_forward` (Launched: 2025-06-09)

Navigate browser history.

**Parameters**:

- `direction` (string, required): "back" or "forward"
- `tabId` (number, optional): Specific tab ID (default: active tab)

**Example**:

```json
{
  "direction": "back",
  "tabId": 123
}
```

## 📸 Screenshots & Visual

### `chrome_screenshot` (Launched: 2025-06-09)

Take advanced screenshots with various options.

**Parameters**:

- `name` (string, optional): Screenshot filename
- `selector` (string, optional): CSS selector for element screenshot
- `tabId` (number, optional): Target tab to capture (default: active tab)
- `background` (boolean, optional): Attempt capture without bringing tab/window to foreground (viewport-only uses CDP)
- `width` (number, optional): Width in pixels (default: 800)
- `height` (number, optional): Height in pixels (default: 600)
- `storeBase64` (boolean, optional): Return base64 data (default: false)
- `fullPage` (boolean, optional): Capture full page (default: true)

**Example**:

```json
{
  "selector": ".main-content",
  "fullPage": true,
  "storeBase64": true,
  "width": 1920,
  "height": 1080
}
```

**Response**:

```json
{
  "success": true,
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "dimensions": {
    "width": 1920,
    "height": 1080
  }
}
```

## 🌐 Network Monitoring

### `chrome_network_capture_start` (Launched: 2025-06-09)

Start capturing network requests using webRequest API.

**Parameters**:

- `url` (string, optional): URL to navigate to and capture
- `maxCaptureTime` (number, optional): Maximum capture time in ms (default: 30000)
- `inactivityTimeout` (number, optional): Stop after inactivity in ms (default: 3000)
- `includeStatic` (boolean, optional): Include static resources (default: false)

**Example**:

```json
{
  "url": "https://api.example.com",
  "maxCaptureTime": 60000,
  "includeStatic": false
}
```

### `chrome_network_capture_stop` (Launched: 2025-06-09)

Stop network capture and return collected data.

**Parameters**: None

**Response**:

```json
{
  "success": true,
  "capturedRequests": [
    {
      "url": "https://api.example.com/data",
      "method": "GET",
      "status": 200,
      "requestHeaders": {...},
      "responseHeaders": {...},
      "responseTime": 150
    }
  ],
  "summary": {
    "totalRequests": 15,
    "captureTime": 5000
  }
}
```

### `chrome_network_debugger_start` (Launched: 2025-06-09)

Start capturing with Chrome Debugger API (includes response bodies).

**Parameters**:

- `url` (string, optional): URL to navigate to and capture

### `chrome_network_debugger_stop` (Launched: 2025-06-09)

Stop debugger capture and return data with response bodies.

### `chrome_network_request` (Launched: 2025-06-09)

Send custom HTTP requests.

**Parameters**:

- `url` (string, required): Request URL
- `method` (string, optional): HTTP method (default: "GET")
- `headers` (object, optional): Request headers
- `body` (string, optional): Request body

**Example**:

```json
{
  "url": "https://api.example.com/data",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"key\": \"value\"}"
}
```

### `wait_extract_response` (since v2.0.2)

Wait for a network response after navigation or a click. Optionally click a confirmation control, and return HTTP status, request body, and response body so async operations (e.g. deletes) can be verified. Provide `extract` only when JSON records need to be extracted via JSONPath.

**Parameters**:

- `action` (object, required): Navigation or click action that triggers the network request
- `confirm` (object, optional): Optional confirmation control to click (e.g. a confirm-dialog button)
- `response` (object, required): Expected response conditions (URL pattern, method, status, etc.)
- `extract` (object, optional): JSONPath-based record extraction from the response body
- `tabId` (number, optional): Target tab ID
- `windowId` (number, optional): Target window ID
- `frameSelector` (string, optional): Same-origin iframe selector

**Example**:

```json
{
  "action": { "type": "click", "selector": "#delete-button" },
  "confirm": { "selector": ".confirm-dialog button" },
  "response": { "urlPattern": "/api/items/*", "method": "DELETE" }
}
```

**Response**:

```json
{
  "success": true,
  "httpStatus": 200,
  "requestBody": "...",
  "responseBody": "{ \"deleted\": 3 }",
  "elapsedMs": 850
}
```

### `chrome_block_images` (Launched: 2026-07-17)

Block image HTTP requests in a tab via CDP. Useful to save bandwidth and speed up page loads when called before navigation or reload.

**Parameters**:

- `action` (string, required): `"start"` to begin blocking, `"stop"` to stop blocking
- `tabId` (number, optional): Target tab ID, defaults to the active tab

**Example**:

```json
{
  "action": "start"
}
```

## 🔍 Content Analysis

### `chrome_read_page` (Launched: 2025-10-09)

Build an accessibility-like tree of the current page (visible viewport by default) with stable `ref_*` identifiers and viewport info. Useful for semantic element discovery or agent planning.

Parameters:

- `filter` (string, optional): `interactive` to only include interactive elements; default includes structural and labeled nodes.
- `tabId` (number, optional): Target an existing tab by ID (default: active tab).

Example:

```json
{
  "filter": "interactive"
}
```

Response contains `pageContent` (text tree), `viewport`, and a `refMapCount` summary. Use `chrome_get_interactive_elements` or your own logic to act on returned refs.

### `search_tabs_content` (Launched: 2025-06-09)

AI-powered semantic search across browser tabs.

**Parameters**:

- `query` (string, required): Search query

**Example**:

```json
{
  "query": "machine learning tutorials"
}
```

**Response**:

```json
{
  "success": true,
  "totalTabsSearched": 10,
  "matchedTabsCount": 3,
  "vectorSearchEnabled": true,
  "indexStats": {
    "totalDocuments": 150,
    "totalTabs": 10,
    "semanticEngineReady": true
  },
  "matchedTabs": [
    {
      "tabId": 123,
      "url": "https://example.com/ml-tutorial",
      "title": "Machine Learning Tutorial",
      "semanticScore": 0.85,
      "matchedSnippets": ["Introduction to machine learning..."],
      "chunkSource": "content"
    }
  ]
}
```

### `chrome_get_web_content` (Launched: 2025-06-09)

Extract HTML or text content from web pages.

**Parameters**:

- `format` (string, optional): "html" or "text" (default: "text")
- `selector` (string, optional): CSS selector for specific elements
- `tabId` (number, optional): Specific tab ID (default: active tab)
- `background` (boolean, optional): Do not activate tab/focus window while fetching (default: true)

**Example**:

```json
{
  "format": "text",
  "selector": ".article-content"
}
```

### `chrome_get_interactive_elements` (since v1.6.4; Launched: 2025-06-09)

Replaced by `chrome_read_page` as the primary discovery tool. The `read_page` implementation will automatically fallback to the interactive-elements logic when the accessibility tree is unavailable or too sparse. This tool is kept for backward compatibility.

## 🎯 Interaction

### `chrome_computer` (Launched: 2025-10-09)

Unified advanced interaction tool that prioritizes high-level DOM actions with CDP fallback. Supports hover, click, drag, scroll, typing, key chords, fill, wait and screenshot. If a recent screenshot was taken via `chrome_screenshot`, coordinates are auto-scaled from screenshot space to viewport space.

Parameters:

- `action` (string, required): `left_click` | `right_click` | `double_click` | `triple_click` | `left_click_drag` | `scroll` | `type` | `key` | `fill` | `hover` | `wait` | `screenshot`
- `tabId` (number, optional): Target an existing tab by ID (default: active tab)
- `background` (boolean, optional): Avoid focusing/activating tab/window for certain operations (best-effort)
- `ref` (string, optional): element ref from `chrome_read_page` (preferred). Used for click/scroll/type/key and as drag end when provided
- `coordinates` (object, optional): `{ "x": 100, "y": 200 }` for click/scroll or drag end
- `startRef` (string, optional): element ref for drag start
- `startCoordinates` (object, optional): for `left_click_drag` when no `startRef`
- `scrollDirection` (string, optional): `up` | `down` | `left` | `right`
- `scrollAmount` (number, optional): ticks 1–10 (default 3)
- `text` (string, optional): for `type` (raw text) or `key` (space-separated chords/keys like `"cmd+a Enter"`)
- `duration` (number, optional): seconds for `wait` (max 30)
- `selector` (string, optional): for `fill` when no `ref`
- `value` (string, optional): for `fill` value

Examples:

```json
{ "action": "left_click", "coordinates": { "x": 420, "y": 260 } }
```

```json
{ "action": "key", "text": "cmd+a Backspace" }
```

````json
{ "action": "fill", "ref": "ref_7", "value": "user@example.com" }

```json
{ "action": "hover", "ref": "ref_12", "duration": 0.6 }
````

````

```json
{ "action": "left_click_drag", "startRef": "ref_10", "ref": "ref_15" }
````

### `chrome_locate_element` (since v2.0.2)

Locate a page element and return a fresh ref, selector, coordinates, and element metadata. Supports persisted marker IDs/names, refs, CSS/XPath, visible text, ARIA role, aria-label, data-testid, and form name. It can scroll to and briefly highlight the target. The returned ref can be passed directly to `chrome_click_element` or `chrome_fill_or_select`.

**Parameters**:

- `markerId` / `markerName` (string, optional): Persisted element marker ID/name (from `chrome_read_page` markedElements)
- `ref` (string, optional): Element ref from `chrome_read_page` or a previous locate call
- `selector` (string, optional): CSS selector or XPath
- `selectorType` (string, optional): `css` (default) | `xpath`
- `text` (string, optional): Visible or accessible element text (fuzzy matching supported)
- `role` (string, optional): ARIA or inferred role, e.g. `button`, `textbox`, `link`
- `ariaLabel` (string, optional): `aria-label` value to match
- `testId` (string, optional): `data-testid` / `data-test` / `data-qa` / `data-cy` value
- `name` (string, optional): Form element `name` attribute
- `allowMultiple` (boolean, optional): Allow multiple matches and return the first (default: false)
- `scrollIntoView` (boolean, optional): Scroll target to viewport center (default: true)
- `highlight` (boolean, optional): Briefly highlight the target (default: true)
- `timeout` (number, optional): Max wait in ms (default: 5000)
- `tabId` / `windowId` / `frameId` (number, optional): Target tab/window/iframe

**Example**:

```json
{
  "text": "Delete",
  "role": "button",
  "allowMultiple": true
}
```

**Response**:

```json
{
  "success": true,
  "ref": "ref_42",
  "selector": "button[data-testid=\"delete\"]",
  "coordinates": { "x": 420, "y": 260 },
  "tagName": "BUTTON",
  "text": "Delete",
  "matchCount": 1
}
```

### `chrome_click_element` (Launched: 2025-06-09)

Click elements using a ref, selector, or coordinates.

**Parameters**:

- `ref` (string, optional): Element ref from `chrome_read_page` (preferred when available)
- `selector` (string, optional): CSS selector for target element
- `coordinates` (object, optional): `{ "x": 120, "y": 240 }` viewport coordinates

At least one of `ref`, `selector`, or `coordinates` must be provided.

**Example**:

```json
{
  "ref": "ref_42"
}
```

### `chrome_fill_or_select` (Launched: 2025-06-09)

Fill form fields or select options.

**Parameters**:

- `ref` (string, optional): Element ref from `chrome_read_page`
- `selector` (string, optional): CSS selector for target element
- `value` (string, required): Value to fill or select

Provide `ref` or `selector` to identify the element.

**Example**:

```json
{
  "ref": "ref_7",
  "value": "user@example.com"
}
```

### `chrome_keyboard` (Launched: 2025-06-09)

Simulate keyboard input and shortcuts.

**Parameters**:

- `keys` (string, required): Key combination (e.g., "Ctrl+C", "Enter")
- `selector` (string, optional): Target element selector
- `delay` (number, optional): Delay between keystrokes in ms (default: 0)

**Example**:

```json
{
  "keys": "Ctrl+A",
  "selector": "#text-input",
  "delay": 100
}
```

## 📚 Data Management

### `chrome_history` (Launched: 2025-06-09)

Search browser history with filters.

**Parameters**:

- `text` (string, optional): Search text in URL/title
- `startTime` (string, optional): Start date (ISO format)
- `endTime` (string, optional): End date (ISO format)
- `maxResults` (number, optional): Maximum results (default: 100)
- `excludeCurrentTabs` (boolean, optional): Exclude current tabs (default: true)

**Example**:

```json
{
  "text": "github",
  "startTime": "2024-01-01",
  "maxResults": 50
}
```

### `chrome_bookmark_search` (Launched: 2025-06-09)

Search bookmarks by keywords.

**Parameters**:

- `query` (string, optional): Search keywords
- `maxResults` (number, optional): Maximum results (default: 100)
- `folderPath` (string, optional): Search within specific folder

**Example**:

```json
{
  "query": "documentation",
  "maxResults": 20,
  "folderPath": "Work/Resources"
}
```

### `chrome_bookmark_add` (Launched: 2025-06-09)

Add new bookmarks with folder support.

**Parameters**:

- `url` (string, optional): URL to bookmark (default: current tab)
- `title` (string, optional): Bookmark title (default: page title)
- `parentId` (string, optional): Parent folder ID or path
- `createFolder` (boolean, optional): Create folder if not exists (default: false)

**Example**:

```json
{
  "url": "https://example.com",
  "title": "Example Site",
  "parentId": "Work/Resources",
  "createFolder": true
}
```

### `chrome_bookmark_delete` (Launched: 2025-06-09)

Delete bookmarks by ID or URL.

**Parameters**:

- `bookmarkId` (string, optional): Bookmark ID to delete
- `url` (string, optional): URL to find and delete

**Example**:

```json
{
  "url": "https://example.com"
}
```

### `chrome_cookie_get` (since v1.6.4; Launched: 2026-07-30)

Get browser cookies, optionally filtered by URL, domain, name, or cookie store.

**Parameters**:

- `url` (string, optional): Only return cookies that apply to this URL
- `domain` (string, optional): Only return cookies for this domain
- `name` (string, optional): Only return cookies with this name
- `storeId` (string, optional): Only return cookies from this browser profile store

**Example**:

```json
{
  "url": "https://example.com"
}
```

### `chrome_cookie_set` (since v1.6.4; Launched: 2026-07-30)

Set a browser cookie, including HttpOnly, Secure, SameSite, path, and expiration settings.

**Parameters**:

- `url` (string, required): A URL on the cookie domain; required by Chrome to set the cookie
- `name` (string, required): Cookie name
- `value` (string, required): Cookie value
- `domain` (string, optional): Cookie domain; it must match the URL host
- `path` (string, optional): Cookie path (default: `/`)
- `secure` (boolean, optional): Send only over HTTPS
- `httpOnly` (boolean, optional): Hide from page JavaScript
- `sameSite` (string, optional): `no_restriction` | `lax` | `strict` | `unspecified`
- `expirationDate` (number, optional): Unix timestamp in seconds; omit for a session cookie
- `storeId` (string, optional): Browser profile store ID

**Example**:

```json
{
  "url": "https://example.com",
  "name": "session_id",
  "value": "abc123",
  "domain": "example.com",
  "secure": true,
  "sameSite": "lax"
}
```

### `chrome_cookie_delete` (since v1.6.4; Launched: 2026-07-30)

Delete a cookie identified by its URL and name.

**Parameters**:

- `url` (string, required): A URL matching the cookie to delete
- `name` (string, required): Cookie name
- `storeId` (string, optional): Browser profile store ID

**Example**:

```json
{
  "url": "https://example.com",
  "name": "session_id"
}
```

### `chrome_get_tab_url` (Launched: 2026-07-15)

Get the current URL and title of a browser tab. Lightweight alternative to `get_windows_and_tabs` when only the current URL is needed.

**Parameters**:

- `tabId` (number, optional): Target tab ID (default: active tab)
- `windowId` (number, optional): Target window ID to pick active tab from

**Example**:

```json
{ "tabId": 123 }
```

**Response**:

```json
{
  "url": "https://example.com/page",
  "title": "Example Page",
  "tabId": 123,
  "windowId": 456,
  "favIconUrl": "https://example.com/favicon.ico",
  "status": "complete",
  "active": true
}
```

### `chrome_scroll` (Launched: 2026-07-15)

Scroll the page or a scrollable container with 4 modes.

For human scrolling, set `humanLazyLoad: true` to enable human lazy-load optimization. After each paced scroll round it watches DOM, layout, and resource changes and waits for the page to settle. Disabled by default.

**Parameters**:

- `mode` (string, optional): Scroll speed mode: `fast` (default), `human`, `humanFast`, or `humanSlow`; for the three human modes, omitted `steps` scale proportionally from `amount=600` → `steps=15` by distance, while `intervalMs` stays constant at `50/20/80ms` per mode (independent of distance)
- `humanLazyLoad` (boolean, optional): Human lazy-load optimization; applies to the three human modes, watching DOM, layout, and resource changes after each paced scroll round and waiting for the page to settle (default: `false`); combine with `toBottom` for infinite lists
- `amount` (number, optional): Pixels to scroll (positive = down/right, negative = up/left)
- `direction` (string, optional): `down` | `up` | `left` | `right`
- `steps` (number, optional): Split pixel scrolling into this many steps (fast default: `1`; human modes default to `15` at 600px and auto-scale from amount when omitted; maximum: `50`); explicit values override the automatic value
- `intervalMs` (number, optional): Milliseconds to wait between pixel-scroll steps (fast default: `0`; human, humanFast, and humanSlow keep a constant `50ms`, `20ms`, or `80ms` when omitted — independent of distance; maximum: `2000`); explicit values override the automatic value
- `toBottom` (boolean, optional): Scroll to the bottom; in human modes, keep taking the selected human-paced steps until the bottom is stable or the request limit is reached
- `toTop` (boolean, optional): Scroll to the top of the container
- `selector` (string, optional): CSS selector of element to scroll into view
- `scrollIntoView` (boolean, optional): Use `scrollIntoView` (default: true with selector)
- `block` (string, optional): `start` | `center` | `end` | `nearest` (default: `center`)
- `behavior` (string, optional): `auto` | `smooth` (default: `auto`)
- `containerSelector` (string, optional): CSS selector of scroll container (auto-detected if omitted)
- `anchorSelector` (string, optional): CSS selector for content inside a nested or virtualized scroll container; improves auto-detection
- `tabId` (number, optional): Target tab ID (default: active tab)
- `windowId` (number, optional): Target window ID

**Examples**:

```json
{ "amount": 500 }
{ "mode": "human", "amount": 600 }
{ "mode": "humanFast", "amount": 600 }
{ "mode": "humanSlow", "amount": 600 }
{ "mode": "human", "amount": 600, "humanLazyLoad": true }
{ "mode": "human", "toBottom": true, "humanLazyLoad": true }
{ "amount": 1000, "direction": "down", "steps": 10, "intervalMs": 150 }
{ "toBottom": true }
{ "selector": "#load-more-button", "block": "center" }
```

**Response**:

```json
{
  "scrollTop": 1500,
  "scrollHeight": 4500,
  "clientHeight": 900,
  "atBottom": false,
  "atTop": false
}
```

### `chrome_get_scroll_state` (Launched: 2026-07-17)

Get the native scroll state of the page or a scrollable container. Useful to call before/after scrolling to check if the bottom or top has been reached, especially for lazy-loaded pages.

**Parameters**:

- `containerSelector` (string, optional): CSS selector of the scroll container. Auto-detects main container if omitted.
- `anchorSelector` (string, optional): CSS selector for content inside the intended scroll container; use the same value as `chrome_scroll`.
- `frameSelector` (string, optional): CSS selector for a same-origin iframe containing the scroll container.
- `tabId` (number, optional): Target tab ID (default: active tab).
- `windowId` (number, optional): Target window ID to pick active tab from.

**Example**:

```json
{}
```

**Response**:

```json
{
  "target": "document.scrollingElement",
  "y": 1500,
  "maxY": 4500,
  "atTop": false,
  "atBottom": false
}
```

### `chrome_wait` (Launched: 2026-07-15)

Wait for a DOM element or JavaScript condition to become true. Polls the page at a configurable interval. Returns `{ found: false }` on timeout (does not throw).

**Parameters**:

- `selector` (string, optional): CSS selector to wait for
- `waitFor` (string, optional): `visible` (default) | `present` | `hidden` | `gone` | `enabled`
- `jsCondition` (string, optional): Custom JS expression returning boolean (alternative to selector)
- `timeout` (number, optional): Max wait time in ms (default: 10000, max: 120000)
- `pollInterval` (number, optional): Poll interval in ms (default: 200, min: 50)
- `tabId` (number, optional): Target tab ID (default: active tab)
- `windowId` (number, optional): Target window ID

**Examples**:

```json
{
  "selector": ".product-list",
  "waitFor": "visible",
  "timeout": 15000
}
```

```json
{
  "jsCondition": "document.querySelectorAll('.item').length >= 10",
  "timeout": 20000
}
```

**Response** (found):

```json
{
  "found": true,
  "elapsedMs": 1200,
  "count": 1,
  "tag": "div#products",
  "visible": true,
  "rect": { "top": 100, "left": 0, "width": 800, "height": 600 }
}
```

**Response** (timeout):

```json
{
  "found": false,
  "elapsedMs": 10000,
  "timeout": 10000
}
```

### `chrome_extract` (Launched: 2026-07-15)

Extract structured data from a web page using CSS selectors. The core tool for web scraping. Supports nested field extraction, 7 extraction modes, and configurable limits.

**Parameters**:

- `selector` (string, required): CSS selector for elements to extract (each match = one result item)
- `fields` (array, required): Fields to extract from each matched element
  - `name` (string, required): Output field name
  - `selector` (string, optional): Relative CSS selector (default: use parent element)
  - `type` (string, optional): `text` (default) | `html` | `outerHtml` | `attribute` | `number` | `href` | `src`
  - `attribute` (string, optional): Attribute name when type is `attribute`
  - `multiple` (boolean, optional): Return array of all matches (default: false)
  - `defaultValue` (any, optional): Fallback value (default: null)
- `contextSelector` (string, optional): Narrow extraction to a parent container
- `limit` (number, optional): Max items to return
- `offset` (number, optional): Skip first N items
- `waitForSelector` (boolean, optional): Wait for selector before extracting (default: true)
- `waitTimeout` (number, optional): Wait timeout in ms (default: 5000)
- `tabId` (number, optional): Target tab ID (default: active tab)
- `windowId` (number, optional): Target window ID

**Example**:

```json
{
  "selector": ".product-card",
  "fields": [
    { "name": "title", "selector": ".product-title", "type": "text" },
    { "name": "price", "selector": ".price", "type": "number" },
    { "name": "link", "selector": "a", "type": "href" },
    { "name": "rating", "selector": ".stars", "type": "attribute", "attribute": "data-score" },
    { "name": "tags", "selector": ".tag", "type": "text", "multiple": true }
  ],
  "limit": 20
}
```

**Response**:

```json
{
  "items": [
    {
      "title": "Product A",
      "price": 29.99,
      "link": "https://example.com/product-a",
      "rating": "4.5",
      "tags": ["sale", "popular"]
    }
  ],
  "total": 45,
  "returned": 20,
  "pageUrl": "https://example.com/products"
}
```

### `chrome_spa_fetch` (since v1.6.3; Launched: 2026-07-29)

A dedicated content extraction tool for SPAs (Single Page Applications). Automatically navigates to a URL, waits for JavaScript rendering, scrolls to trigger lazy-loaded content, then extracts the full rendered text. Solves the problem of fetching content from JS-heavy sites like X/Twitter and Reddit where plain HTTP requests return an empty shell.

Best for: extracting tweet timelines, post feeds, dynamically loaded articles, and any content that requires JS execution and scrolling.

**Parameters**:

- `url` (string, required): Target SPA URL
- `maxScrolls` (number, optional): Maximum scroll-to-bottom passes (default: 5). For infinite-scroll feeds like Twitter timeline, set to 10–15
- `scrollDelay` (number, optional): Delay between scroll steps in ms (default: 2000). Gives dynamic content time to render
- `waitForSelector` (string, optional): Wait for a specific CSS selector before starting extraction. For Twitter: `[data-testid="tweet"]`
- `waitTimeout` (number, optional): Max wait time for selector in ms (default: 20000)
- `extractHtml` (boolean, optional): Whether to also return rendered HTML (default: false)
- `tabId` (number, optional): Target an existing tab (default: create new tab)
- `windowId` (number, optional): Target window ID

**Example**:

```json
{
  "url": "https://x.com/elonmusk",
  "maxScrolls": 10,
  "scrollDelay": 2500,
  "waitForSelector": "[data-testid=\"tweet\"]"
}
```

**Response**:

```json
{
  "success": true,
  "url": "https://x.com/elonmusk",
  "title": "Elon Musk (@elonmusk) / X",
  "scrollsPerformed": 8,
  "reachedMaxScrolls": false,
  "textContent": "Full rendered page text...",
  "article": {
    "title": "Elon Musk (@elonmusk) / X",
    "siteName": "X",
    "excerpt": "...",
    "lang": "en"
  }
}
```

### `chrome_select_all_items` (since v2.0.2)

Safely select all items in a lazy or virtualized list: scroll to the bottom, wait for the card count to stabilize over consecutive rounds, then toggle the checkbox inside each card. It does not rely on a broken page-level "select all" control, nor does it treat optimistic DOM counts as server-side success.

**Parameters**:

- `cardSelector` (string, required): CSS selector for each list card
- `checkboxSelector` (string, required): CSS selector for the checkbox inside each card, e.g. `input[type="checkbox"]`
- `containerSelector` (string, optional): Scroll container selector (default: page scroll)
- `step` (number, optional): Scroll step in pixels (default: 500)
- `settleMs` (number, optional): Wait after each scroll for lazy loading (default: 500)
- `stableRounds` (number, optional): Consecutive stable bottom rounds (default: 3)
- `maxRounds` (number, optional): Max scroll rounds (default: 200)
- `maxDurationMs` (number, optional): Max runtime (default: 120000)
- `restoreScroll` (boolean, optional): Restore original scroll position (default: false)
- `tabId` / `windowId` (number, optional): Target tab/window

**Example**:

```json
{
  "cardSelector": ".product-card",
  "checkboxSelector": "input[type=\"checkbox\"]",
  "step": 500,
  "stableRounds": 3
}
```

**Response**:

```json
{
  "success": true,
  "cardsFound": 128,
  "selected": 128,
  "rounds": 42,
  "elapsedMs": 18500
}
```

### `collect_virtual_list` (since v1.8.12)

Collect and deduplicate records from a dynamic or virtualized list while scrolling. It supports nested scroll containers, adaptive loading waits, resumable state, optional result batches, and progress snapshots.

**Parameters**:

- `cardSelector` (string, required): CSS selector for each record card
- `fields` (array, required): Fields to extract from each card
- `identityFields` (array, required): Fields used to deduplicate records
- `maxItems` (number, optional): Maximum records to collect (default: 100)
- `containerSelector` / `anchorSelector` (string, optional): Identify a nested scroll container directly or through an anchor inside it
- `scroll` (object, optional): `step`, `waitMs`, `waitTimeoutMs`, `settleMs`, `stalledLimit`, `rescanUp`, `containerSelector`, and `anchorSelector`
- `state` (object, optional): Pass back the previous `state` response to resume from `scrollY` and `seenIds`
- `returnBatches` (boolean, optional): Include `batches` in the final response
- `batchSize` (number, optional): Records per batch (default: 25 when batching is enabled)
- `returnProgress` (boolean, optional): Include per-step progress snapshots in the final response
- `progressEverySteps` (number, optional): Store one progress snapshot every N scroll steps
- `tabId` or `windowId` (number, optional): Select the target tab; `windowId` selects its active tab

**Example**:

```json
{
  "tabId": 123,
  "cardSelector": ".product-card",
  "fields": [
    { "name": "id", "selector": "[data-id]", "type": "attribute", "attribute": "data-id" }
  ],
  "identityFields": ["id"],
  "containerSelector": ".virtual-list",
  "returnBatches": true,
  "returnProgress": true,
  "scroll": { "step": 500, "waitMs": 600, "rescanUp": true }
}
```

### `collect_virtual_lists` (since v1.8.12)

Run the same collection workflow across multiple tabs or windows with bounded concurrency. Each target returns an independent result, state, progress, batches, and failure reason.

**Parameters**:

- `targets` (array, required): Objects containing `tabId` or `windowId`; a target may also override `frameSelector`, `containerSelector`, `anchorSelector`, `scroll`, and `state`
- All single-target collection parameters above, except the root `tabId`, `windowId`, and `state`
- `maxConcurrency` (number, optional): Concurrent target limit (default: 3, maximum: 8)
- `failFast` (boolean, optional): Stop starting new targets after the first failure

When the MCP request includes `_meta.progressToken` and the client supports `notifications/progress`, the collector emits live progress notifications while it runs. `returnProgress` still controls snapshots included in the final result.

**Example**:

```json
{
  "targets": [
    { "tabId": 101, "label": "window-a" },
    { "tabId": 202, "label": "window-b" }
  ],
  "cardSelector": ".item",
  "fields": [{ "name": "id", "selector": ".id" }],
  "identityFields": ["id"],
  "maxConcurrency": 2,
  "returnBatches": true
}
```

## 📋 Response Format

All tools return responses in the following format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "JSON string containing the actual response data"
    }
  ],
  "isError": false
}
```

For errors:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error message describing what went wrong"
    }
  ],
  "isError": true
}
```

## 🔧 Usage Examples

### Complete Workflow Example

```javascript
// 1. Navigate to a page
await callTool('chrome_navigate', {
  url: 'https://example.com',
});

// 2. Take a screenshot
const screenshot = await callTool('chrome_screenshot', {
  fullPage: true,
  storeBase64: true,
});

// 3. Start network monitoring
await callTool('chrome_network_capture_start', {
  maxCaptureTime: 30000,
});

// 4. Interact with the page
await callTool('chrome_click_element', {
  selector: '#load-data-button',
});

// 5. Search content semantically
const searchResults = await callTool('search_tabs_content', {
  query: 'user data analysis',
});

// 6. Stop network capture
const networkData = await callTool('chrome_network_capture_stop');

// 7. Save bookmark
await callTool('chrome_bookmark_add', {
  title: 'Data Analysis Page',
  parentId: 'Work/Analytics',
});
```

This API provides comprehensive browser automation capabilities with AI-enhanced content analysis and semantic search features.
