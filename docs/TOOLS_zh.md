# Chrome MCP Server API 参考 📚

所有可用工具及其参数的完整参考。

## 📋 目录

- [浏览器管理](#浏览器管理)
- [截图和视觉](#截图和视觉)
- [网络监控](#网络监控)
- [内容分析](#内容分析)
- [交互操作](#交互操作)
- [数据管理](#数据管理)
- [抓取与提取](#抓取与提取)
- [响应格式](#响应格式)

## 📊 浏览器管理

### `get_windows_and_tabs`

列出当前打开的所有浏览器窗口和标签页。

**参数**：无

**响应**：

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
          "title": "示例页面",
          "active": true
        }
      ]
    }
  ]
}
```

### `chrome_navigate`

导航到指定 URL，可选择控制视口。

**参数**：

- `url` (字符串，必需)：要导航到的 URL
- `newWindow` (布尔值，可选)：创建新窗口（默认：false）
- `width` (数字，可选)：视口宽度（像素，默认：1280）
- `height` (数字，可选)：视口高度（像素，默认：720）

**示例**：

```json
{
  "url": "https://example.com",
  "newWindow": true,
  "width": 1920,
  "height": 1080
}
```

### `chrome_close_tabs`

关闭指定的标签页或窗口。

**参数**：

- `tabIds` (数组，可选)：要关闭的标签页 ID 数组
- `windowIds` (数组，可选)：要关闭的窗口 ID 数组

**示例**：

```json
{
  "tabIds": [123, 456],
  "windowIds": [789]
}
```

### `chrome_switch_tab`

切换到指定的浏览器标签页。

**参数**：

- `tabId` (数字，必需)：要切换到的标签页的 ID。
- `windowId` (数字，可选)：该标签页所在窗口的 ID。

**示例**：

```json
{
  "tabId": 456,
  "windowId": 123
}
```

### `chrome_go_back_or_forward`

浏览器历史导航。

**参数**：

- `direction` (字符串，必需)："back" 或 "forward"
- `tabId` (数字，可选)：特定标签页 ID（默认：活动标签页）

**示例**：

```json
{
  "direction": "back",
  "tabId": 123
}
```

## 📸 截图和视觉

### `chrome_screenshot`

使用各种选项进行高级截图。

**参数**：

- `name` (字符串，可选)：截图文件名
- `selector` (字符串，可选)：元素截图的 CSS 选择器
- `width` (数字，可选)：宽度（像素，默认：800）
- `height` (数字，可选)：高度（像素，默认：600）
- `storeBase64` (布尔值，可选)：返回 base64 数据（默认：false）
- `fullPage` (布尔值，可选)：捕获整个页面（默认：true）

**示例**：

```json
{
  "selector": ".main-content",
  "fullPage": true,
  "storeBase64": true,
  "width": 1920,
  "height": 1080
}
```

**响应**：

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

## 🌐 网络监控

### `chrome_network_capture_start`

使用 webRequest API 开始捕获网络请求。

**参数**：

- `url` (字符串，可选)：要导航并捕获的 URL
- `maxCaptureTime` (数字，可选)：最大捕获时间（毫秒，默认：30000）
- `inactivityTimeout` (数字，可选)：无活动后停止时间（毫秒，默认：3000）
- `includeStatic` (布尔值，可选)：包含静态资源（默认：false）

**示例**：

```json
{
  "url": "https://api.example.com",
  "maxCaptureTime": 60000,
  "includeStatic": false
}
```

### `chrome_network_capture_stop`

停止网络捕获并返回收集的数据。

**参数**：无

**响应**：

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

### `chrome_network_debugger_start`

使用 Chrome Debugger API 开始捕获（包含响应体）。

**参数**：

- `url` (字符串，可选)：要导航并捕获的 URL

### `chrome_network_debugger_stop`

停止调试器捕获并返回包含响应体的数据。

### `chrome_network_request`

发送自定义 HTTP 请求。

**参数**：

- `url` (字符串，必需)：请求 URL
- `method` (字符串，可选)：HTTP 方法（默认："GET"）
- `headers` (对象，可选)：请求头
- `body` (字符串，可选)：请求体

**示例**：

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

### `chrome_block_images`

通过 CDP 阻止标签页中的图片 HTTP 请求。适合在导航或刷新前调用，以节省带宽、加速页面加载。

**参数**：

- `action` (字符串，必需)：`"start"` 开始拦截，`"stop"` 停止拦截
- `tabId` (数字，可选)：目标标签页 ID，默认当前活动标签页

**示例**：

```json
{
  "action": "start"
}
```

## 🔍 内容分析

### `search_tabs_content`

跨浏览器标签页的 AI 驱动语义搜索。

**参数**：

- `query` (字符串，必需)：搜索查询

**示例**：

```json
{
  "query": "机器学习教程"
}
```

**响应**：

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
      "title": "机器学习教程",
      "semanticScore": 0.85,
      "matchedSnippets": ["机器学习简介..."],
      "chunkSource": "content"
    }
  ]
}
```

### `chrome_get_web_content`

从网页提取 HTML 或文本内容。

**参数**：

- `format` (字符串，可选)："html" 或 "text"（默认："text"）
- `selector` (字符串，可选)：特定元素的 CSS 选择器
- `tabId` (数字，可选)：特定标签页 ID（默认：活动标签页）

**示例**：

```json
{
  "format": "text",
  "selector": ".article-content"
}
```

### `chrome_get_interactive_elements`

查找页面上可点击和交互的元素。

**参数**：

- `tabId` (数字，可选)：特定标签页 ID（默认：活动标签页）

**响应**：

```json
{
  "elements": [
    {
      "selector": "#submit-button",
      "type": "button",
      "text": "提交",
      "visible": true,
      "clickable": true
    }
  ]
}
```

## 🎯 交互操作

### `chrome_click_element`

使用 CSS 选择器点击元素。

**参数**：

- `selector` (字符串，必需)：目标元素的 CSS 选择器
- `tabId` (数字，可选)：特定标签页 ID（默认：活动标签页）

**示例**：

```json
{
  "selector": "#submit-button"
}
```

### `chrome_fill_or_select`

填充表单字段或选择选项。

**参数**：

- `selector` (字符串，必需)：目标元素的 CSS 选择器
- `value` (字符串，必需)：要填充或选择的值
- `tabId` (数字，可选)：特定标签页 ID（默认：活动标签页）

**示例**：

```json
{
  "selector": "#email-input",
  "value": "user@example.com"
}
```

### `chrome_keyboard`

模拟键盘输入和快捷键。

**参数**：

- `keys` (字符串，必需)：按键组合（如："Ctrl+C"、"Enter"）
- `selector` (字符串，可选)：目标元素选择器
- `delay` (数字，可选)：按键间延迟（毫秒，默认：0）

**示例**：

```json
{
  "keys": "Ctrl+A",
  "selector": "#text-input",
  "delay": 100
}
```

## 📚 数据管理

### `chrome_history`

使用过滤器搜索浏览器历史记录。

**参数**：

- `text` (字符串，可选)：在 URL/标题中搜索文本
- `startTime` (字符串，可选)：开始日期（ISO 格式）
- `endTime` (字符串，可选)：结束日期（ISO 格式）
- `maxResults` (数字，可选)：最大结果数（默认：100）
- `excludeCurrentTabs` (布尔值，可选)：排除当前标签页（默认：true）

**示例**：

```json
{
  "text": "github",
  "startTime": "2024-01-01",
  "maxResults": 50
}
```

### `chrome_bookmark_search`

按关键词搜索书签。

**参数**：

- `query` (字符串，可选)：搜索关键词
- `maxResults` (数字，可选)：最大结果数（默认：100）
- `folderPath` (字符串，可选)：在特定文件夹内搜索

**示例**：

```json
{
  "query": "文档",
  "maxResults": 20,
  "folderPath": "工作/资源"
}
```

### `chrome_bookmark_add`

添加支持文件夹的新书签。

**参数**：

- `url` (字符串，可选)：要收藏的 URL（默认：当前标签页）
- `title` (字符串，可选)：书签标题（默认：页面标题）
- `parentId` (字符串，可选)：父文件夹 ID 或路径
- `createFolder` (布尔值，可选)：如果不存在则创建文件夹（默认：false）

**示例**：

```json
{
  "url": "https://example.com",
  "title": "示例网站",
  "parentId": "工作/资源",
  "createFolder": true
}
```

### `chrome_bookmark_delete`

按 ID 或 URL 删除书签。

**参数**：

- `bookmarkId` (字符串，可选)：要删除的书签 ID
- `url` (字符串，可选)：要查找并删除的 URL

**示例**：

```json
{
  "url": "https://example.com"
}
```

## 🕸️ 抓取与提取

### `chrome_get_tab_url`

获取浏览器标签页的当前 URL 和标题。当只需要当前 URL 时，比 `get_windows_and_tabs` 更轻量快速。

**参数**：

- `tabId` (数字，可选)：目标标签页 ID（默认：活动标签页）
- `windowId` (数字，可选)：目标窗口 ID，用于选取活动标签页

**示例**：

```json
{ "tabId": 123 }
```

**响应**：

```json
{
  "url": "https://example.com/page",
  "title": "示例页面",
  "tabId": 123,
  "windowId": 456,
  "favIconUrl": "https://example.com/favicon.ico",
  "status": "complete",
  "active": true
}
```

### `chrome_scroll`

滚动页面或可滚动容器，支持多种滚动模式。

懒加载页面可使用 `toBottom: true, lazyLoad: true`，每次以 400px 小步向下滚动、等待 800ms 后立即返回。根据响应中的 `atBottom` 重复调用，直至为 `true`，避免超出单次 MCP 请求时限。

**参数**：

- `amount` (数字，可选)：滚动像素数（正数=下/右，负数=上/左）
- `direction` (字符串，可选)：`down` | `up` | `left` | `right`
- `toBottom` (布尔值，可选)：滚动到容器底部
- `lazyLoad` (布尔值，可选)：与 `toBottom: true` 配合，分段缓慢滚动以等待懒加载内容（默认 `false`）
- `lazyLoadStep` (数字，可选)：每次分段滚动像素数（默认 `400`）
- `lazyLoadWaitMs` (数字，可选)：每次分段滚动后的等待毫秒数（默认 `800`）
- `lazyLoadMaxSteps` (数字，可选)：单次请求最大分段次数（默认 `1`；为避免超时会被限制）
- `toTop` (布尔值，可选)：滚动到容器顶部
- `selector` (字符串，可选)：要滚动到视图中的元素 CSS 选择器
- `scrollIntoView` (布尔值，可选)：使用 `scrollIntoView`（有 selector 时默认 true）
- `block` (字符串，可选)：`start` | `center` | `end` | `nearest`（默认：`center`）
- `behavior` (字符串，可选)：`auto` | `smooth`（默认：`auto`）
- `containerSelector` (字符串，可选)：滚动容器的 CSS 选择器（省略时自动检测主滚动容器）
- `anchorSelector`（字符串，可选）：嵌套或虚拟列表中内容的 CSS 选择器，用于提升自动检测准确性
- `frameSelector` (字符串，可选)：同一源 iframe 的 CSS 选择器，用于在其中执行滚动
- `tabId` (数字，可选)：目标标签页 ID（默认：活动标签页）
- `windowId` (数字，可选)：目标窗口 ID

**示例**：

```json
{ "amount": 500 }
{ "toBottom": true }
{ "selector": "#load-more-button", "block": "center" }
```

**响应**：

```json
{
  "scrollTop": 1500,
  "scrollHeight": 4500,
  "clientHeight": 900,
  "atBottom": false,
  "atTop": false
}
```

### `chrome_get_scroll_state`

获取页面或可滚动容器的原生滚动状态。在滚动前后调用，判断是否到达底部或顶部，适合懒加载页面分步滚动控制。

**参数**：

- `containerSelector` (字符串，可选)：可滚动容器的 CSS 选择器，自动检测主容器
- `anchorSelector`（字符串，可选）：目标滚动容器内内容的 CSS 选择器；应与 `chrome_scroll` 使用相同值
- `frameSelector` (字符串，可选)：同一源 iframe 的 CSS 选择器
- `tabId` (数字，可选)：目标标签页 ID（默认：活动标签页）
- `windowId` (数字，可选)：目标窗口 ID

**示例**：

```json
{}
```

**响应**：

```json
{
  "target": "document.scrollingElement",
  "y": 1500,
  "maxY": 4500,
  "atTop": false,
  "atBottom": false
}
```

### `chrome_wait`

等待 DOM 元素或 JavaScript 条件变为真。以可配置的间隔轮询页面，超时不抛异常，返回 `{ found: false }`。

**参数**：

- `selector` (字符串，可选)：要等待的 CSS 选择器
- `waitFor` (字符串，可选)：`visible`（默认）| `present` | `hidden` | `gone` | `enabled`
- `jsCondition` (字符串，可选)：自定义 JS 表达式返回布尔值（替代 selector）
- `frameSelector` (字符串，可选)：同一源 iframe 的 CSS 选择器，用于在其中评估条件
- `timeout` (数字，可选)：最大等待时间（毫秒，默认：10000，最大：120000）
- `pollInterval` (数字，可选)：轮询间隔（毫秒，默认：200，最小：50）
- `tabId` (数字，可选)：目标标签页 ID（默认：活动标签页）
- `windowId` (数字，可选)：目标窗口 ID

**示例**：

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

**响应（找到）**：

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

**响应（超时）**：

```json
{
  "found": false,
  "elapsedMs": 10000,
  "timeout": 10000
}
```

### `chrome_extract`

使用 CSS 选择器从网页提取结构化数据，是网页抓取的核心工具。支持嵌套字段提取、8 种提取模式、同源 iframe 定位和可配置限制。

**参数**：

- `selector` (字符串，必需)：要提取元素的 CSS 选择器（每个匹配=一个结果项）
- `fields` (数组，必需)：从每个匹配元素中提取的字段
  - `name` (字符串，必需)：输出字段名
  - `selector` (字符串，可选)：相对 CSS 选择器（默认：使用父元素自身）
  - `type` (字符串，可选)：`text`（默认）| `html` | `outerHtml` | `attribute` | `number` | `href` | `src` | `table`
    - `table` 模式会自动提取表格头部和行，支持 colspan/rowspan 展开
  - `attribute` (字符串，可选)：当 type 为 `attribute` 时的属性名
  - `multiple` (布尔值，可选)：返回所有匹配的数组（默认：false）
  - `defaultValue` (任意，可选)：无匹配时的回退值（默认：null）
- `contextSelector` (字符串，可选)：将提取范围限定到父容器
- `frameSelector` (字符串，可选)：同一源 iframe 的 CSS 选择器，用于从中提取数据
- `limit` (数字，可选)：最大返回条目数
- `offset` (数字，可选)：跳过前 N 个匹配项
- `waitForSelector` (布尔值，可选)：提取前等待选择器出现（默认：true）
- `waitTimeout` (数字，可选)：等待超时（毫秒，默认：5000）
- `tabId` (数字，可选)：目标标签页 ID（默认：活动标签页）
- `windowId` (数字，可选)：目标窗口 ID

**示例**：

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

**响应**：

```json
{
  "items": [
    {
      "title": "商品 A",
      "price": 29.99,
      "link": "https://example.com/product-a",
      "rating": "4.5",
      "tags": ["促销", "热门"]
    }
  ],
  "total": 45,
  "returned": 20,
  "pageUrl": "https://example.com/products"
}
```

### `chrome_get_page_text`

使用 Readability 从页面提取可读的主文章内容。返回干净文本、文章 HTML 和元数据（标题、摘要、作者、站点名称、语言、长度等）。

**参数**：

- `selector` (字符串，可选)：CSS 选择器。提供时返回该元素的文本而非 Readability 文章提取结果
- `tabId` (数字，可选)：目标标签页 ID（默认：活动标签页）
- `windowId` (数字，可选)：目标窗口 ID

**示例**：

```json
{
  "tabId": 123
}
```

**响应**：

```json
{
  "title": "文章标题",
  "byline": "作者名",
  "excerpt": "文章摘要...",
  "siteName": "站点名称",
  "lang": "zh-CN",
  "textContent": "文章正文纯文本...",
  "articleHtml": "<div><p>文章 HTML...</p></div>",
  "length": 12345
}
```

### `chrome_click_and_wait`

点击 CSS 选择器指定的元素，然后等待另一个选择器达到指定状态。将 `click` 和 `wait` 合二为一，简化交互流程。

**参数**：

- `selector` (字符串，必需)：要点击的元素的 CSS 选择器
- `waitSelector` (字符串，必需)：点击后等待的 CSS 选择器
- `waitFor` (字符串，可选)：`visible`（默认）| `present` | `hidden` | `gone` | `enabled`
- `waitTimeout` (数字，可选)：最大等待时间（毫秒，默认：10000）
- `tabId` (数字，可选)：目标标签页 ID（默认：活动标签页）
- `windowId` (数字，可选)：目标窗口 ID
- `frameId` (数字，可选)：点击的目标 frame ID
- `frameSelector` (字符串，可选)：等待时所在的同源 iframe 选择器

**示例**：

```json
{
  "selector": "#load-more-button",
  "waitSelector": ".new-content",
  "waitFor": "visible",
  "waitTimeout": 15000
}
```

**响应**：

```json
{
  "clicked": true,
  "found": true,
  "elapsedMs": 2300,
  "count": 5,
  "tag": "div.new-content",
  "visible": true
}
```

## 📋 响应格式

所有工具都返回以下格式的响应：

```json
{
  "content": [
    {
      "type": "text",
      "text": "包含实际响应数据的 JSON 字符串"
    }
  ],
  "isError": false
}
```

对于错误：

```json
{
  "content": [
    {
      "type": "text",
      "text": "描述出错原因的错误消息"
    }
  ],
  "isError": true
}
```

## 🔧 使用示例

### 完整工作流示例

```javascript
// 1. 导航到页面
await callTool('chrome_navigate', {
  url: 'https://example.com',
});

// 2. 截图
const screenshot = await callTool('chrome_screenshot', {
  fullPage: true,
  storeBase64: true,
});

// 3. 开始网络监控
await callTool('chrome_network_capture_start', {
  maxCaptureTime: 30000,
});

// 4. 与页面交互
await callTool('chrome_click_element', {
  selector: '#load-data-button',
});

// 5. 语义搜索内容
const searchResults = await callTool('search_tabs_content', {
  query: '用户数据分析',
});

// 6. 停止网络捕获
const networkData = await callTool('chrome_network_capture_stop');

// 7. 保存书签
await callTool('chrome_bookmark_add', {
  title: '数据分析页面',
  parentId: '工作/分析',
});
```

此 API 提供全面的浏览器自动化功能，具有 AI 增强的内容分析和语义搜索特性。
