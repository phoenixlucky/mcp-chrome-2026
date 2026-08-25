# Chrome MCP Server API 参考 📚

所有可用工具及其参数的完整参考。

## 📋 目录

- [浏览器管理](#浏览器管理)
- [截图和视觉](#截图和视觉)
- [网络监控](#网络监控)
- [内容分析](#内容分析)
- [交互操作](#交互操作)
- [数据管理](#数据管理)（含 Cookie 管理）
- [抓取与提取](#抓取与提取)
- [响应格式](#响应格式)

## 📊 浏览器管理

### `chrome_batch`

按顺序执行最多 50 个浏览器工具调用，可选 `profileId` 将整组任务固定到同一个隔离 Profile。

**参数**：

- `calls` (对象数组，必需)：每项包含 `name` 和可选的 `arguments`
- `stopOnError` (布尔值，可选)：遇到失败是否停止，默认 `true`
- `profileId` (字符串，可选)：整组调用使用的 Profile

### `chrome_profile`

管理隔离 Chrome Profile。省略普通浏览器工具的 `profileId` 时，仍然操作当前 Chrome。

**参数**：

- `action` (字符串，必需)：`list`、`create`、`launch`、`stop`、`delete`、`status` 或 `diagnostics`
- `profileId` (字符串，可选)：Profile ID；`create` 时省略会根据名称生成
- `name` (字符串，可选)：创建 Profile 时使用的显示名称
- `userDataDir` (字符串，可选)：独立 Chrome 的数据目录
- `chromePath` (字符串，可选)：Chrome 可执行文件路径
- `extensionPath` (字符串，可选)：要加载的扩展目录
- `launchArgs` (字符串数组，可选)：额外 Chrome 启动参数

普通浏览器工具也支持可选的 `profileId`。首次调用时会自动启动对应的独立 Chrome；`diagnostics` 会汇总 Profile、CDP、MCP、代理和扩展状态；`delete` 只删除 Profile 配置，不会删除 `userDataDir`。

### `get_windows_and_tabs`（上线时间：2025-06-09）

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

### `chrome_navigate`（上线时间：2025-06-09）

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

### `chrome_close_tabs`（上线时间：2025-06-09）

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

### `chrome_switch_tab`（上线时间：2025-07-24）

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

### `chrome_go_back_or_forward`（已弃用——请使用 `chrome_navigate`，并将 `url` 设为 `"back"` 或 `"forward"`）

> 为旧客户端保留的兼容别名。新客户端应调用 `chrome_navigate`。

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

### `chrome_screenshot`（上线时间：2025-06-09）

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

### `chrome_network_capture_start`（已弃用——请使用 `chrome_network_capture` 的 `action: "start"`）

> 为旧客户端保留的兼容别名。webRequest 后端仍是 `chrome_network_capture` 的有效实现。

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

### `chrome_network_capture_stop`（已弃用——请使用 `chrome_network_capture` 的 `action: "stop"`）

> 为旧客户端保留的兼容别名。webRequest 后端仍是 `chrome_network_capture` 的有效实现。

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

### `chrome_network_debugger_start`（已弃用——请使用 `chrome_network_capture` 的 `action: "start", needResponseBody: true`）

> 为旧客户端保留的兼容别名。Debugger 后端仍是 `chrome_network_capture` 的有效实现。

使用 Chrome Debugger API 开始捕获（包含响应体）。

**参数**：

- `url` (字符串，可选)：要导航并捕获的 URL

### `chrome_network_debugger_stop`（已弃用——请使用 `chrome_network_capture` 的 `action: "stop"`）

> 为旧客户端保留的兼容别名。Debugger 后端仍是 `chrome_network_capture` 的有效实现。

停止调试器捕获并返回包含响应体的数据。

### `chrome_network_request`（上线时间：2025-06-09）

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

### `wait_extract_response`（since v2.0.2）

执行导航或点击后等待指定网络响应。可选地点击确认按钮，并返回 HTTP 状态、请求体和响应体，用于核验删除等异步操作是否真正成功；仅在需要抽取 JSON 记录时提供 `extract`。

**参数**：

- `action` (对象，必需)：触发网络请求的导航或点击动作
- `confirm` (对象，可选)：可选的确认控件（如确认弹窗按钮）
- `response` (对象，必需)：期望的响应条件（URL 模式、方法、状态等）
- `extract` (对象，可选)：基于 JSONPath 从响应体抽取记录
- `tabId` (数字，可选)：目标标签页 ID
- `windowId` (数字，可选)：目标窗口 ID
- `frameSelector` (字符串，可选)：同源 iframe 选择器

**示例**：

```json
{
  "action": { "type": "click", "selector": "#delete-button" },
  "confirm": { "selector": ".confirm-dialog button" },
  "response": { "urlPattern": "/api/items/*", "method": "DELETE" }
}
```

**响应**：

```json
{
  "success": true,
  "httpStatus": 200,
  "requestBody": "...",
  "responseBody": "{ \"deleted\": 3 }",
  "elapsedMs": 850
}
```

### `chrome_block_images`（上线时间：2026-07-17）

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

### `search_tabs_content`（上线时间：2025-06-09）

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

### `chrome_get_web_content`（上线时间：2025-06-09）

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

### `chrome_get_interactive_elements`（已弃用——请使用 `chrome_read_page`）

> 为旧客户端保留的兼容别名。新客户端应使用 `chrome_read_page` 的仅交互元素选项。

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

### `chrome_locate_element`（since v2.0.2）

定位网页元素并返回当前有效的 ref、selector、坐标和元素信息。支持已保存的 markerId/markerName、ref、CSS/XPath、可见文本、ARIA role、aria-label、data-testid 和表单 name；定位时可自动滚动并高亮目标。返回的 ref 可直接传给 `chrome_click_element` 或 `chrome_fill_or_select`。

**参数**：

- `markerId` / `markerName` (字符串，可选)：已保存的元素标记 ID/名称（来自 `chrome_read_page` 的 markedElements）
- `ref` (字符串，可选)：来自 `chrome_read_page` 或此前定位结果的元素引用
- `selector` (字符串，可选)：CSS 选择器或 XPath
- `selectorType` (字符串，可选)：`css`（默认）| `xpath`
- `text` (字符串，可选)：可见或可访问的文本，支持模糊匹配
- `role` (字符串，可选)：ARIA 或推断出的 role，如 `button`、`textbox`、`link`
- `ariaLabel` (字符串，可选)：要匹配的 `aria-label` 值
- `testId` (字符串，可选)：`data-testid` / `data-test` / `data-qa` / `data-cy` 值
- `name` (字符串，可选)：表单元素 `name` 属性
- `allowMultiple` (布尔值，可选)：允许多个匹配并返回第一个（默认：false）
- `scrollIntoView` (布尔值，可选)：将目标滚动到视口中央（默认：true）
- `highlight` (布尔值，可选)：短暂高亮目标（默认：true）
- `timeout` (数字，可选)：最大等待时间（毫秒，默认：5000）
- `tabId` / `windowId` / `frameId` (数字，可选)：目标标签页/窗口/iframe

**示例**：

```json
{
  "text": "Delete",
  "role": "button",
  "allowMultiple": true
}
```

**响应**：

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

### `chrome_click_element`（上线时间：2025-06-09）

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

### `chrome_fill_or_select`（上线时间：2025-06-09）

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

### `chrome_keyboard`（上线时间：2025-06-09）

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

### `chrome_history`（上线时间：2025-06-09）

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

### `chrome_bookmark_search`（上线时间：2025-06-09）

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

### `chrome_bookmark_add`（上线时间：2025-06-09）

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

### `chrome_bookmark_delete`（上线时间：2025-06-09）

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

### `chrome_cookie_get`（上线时间：2026-07-30；since v1.6.4）

获取浏览器 Cookie，支持按 URL、域名、名称或存储分区过滤。

**参数**：

- `url` (字符串，可选)：仅返回此 URL 适用的 Cookie
- `domain` (字符串，可选)：仅返回此域名的 Cookie
- `name` (字符串，可选)：仅返回此名称的 Cookie
- `storeId` (字符串，可选)：仅返回此浏览器存储分区的 Cookie

**示例**：

```json
{
  "url": "https://example.com"
}
```

### `chrome_cookie_set`（上线时间：2026-07-30；since v1.6.4）

设置浏览器 Cookie。支持 HttpOnly、Secure、SameSite、path 和过期时间等选项。

**参数**：

- `url` (字符串，必需)：Cookie 所属域名的 URL；Chrome 要求此参数
- `name` (字符串，必需)：Cookie 名称
- `value` (字符串，必需)：Cookie 值
- `domain` (字符串，可选)：Cookie 域名，必须匹配 URL 主机
- `path` (字符串，可选)：Cookie 路径（默认：`/`）
- `secure` (布尔值，可选)：仅通过 HTTPS 发送
- `httpOnly` (布尔值，可选)：禁止页面 JavaScript 访问
- `sameSite` (字符串，可选)：`no_restriction` | `lax` | `strict` | `unspecified`
- `expirationDate` (数字，可选)：Unix 时间戳（秒），省略则为会话 Cookie
- `storeId` (字符串，可选)：浏览器存储分区 ID

**示例**：

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

### `chrome_cookie_delete`（上线时间：2026-07-30；since v1.6.4）

删除指定的浏览器 Cookie。

**参数**：

- `url` (字符串，必需)：要删除 Cookie 的 URL
- `name` (字符串，必需)：Cookie 名称
- `storeId` (字符串，可选)：浏览器存储分区 ID

**示例**：

```json
{
  "url": "https://example.com",
  "name": "session_id"
}
```

## 🕸️ 抓取与提取

### `chrome_get_tab_url`（上线时间：2026-07-15）

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

### `chrome_scroll`（上线时间：2026-07-15）

滚动页面或可滚动容器，支持多种滚动模式。

真人滚动可使用 `humanLazyLoad: true` 开启真人懒加载优化；每个分步滚动轮次结束后检测 DOM、布局和网络资源变化，并等待页面趋于稳定。默认关闭。

**参数**：

- `mode` (字符串，可选)：滚动速度模式：`fast`（默认）、`human`（标准真人）、`humanFast`（快人）或 `humanSlow`（慢人）；三种真人模式未传 `steps`/`intervalMs` 时，步数以 `amount=600` → `steps=15` 为基准按距离等比计算，步间隔恒定分别为 `50/20/80ms`（不随距离变化）
- `humanLazyLoad` (布尔值，可选)：真人懒加载优化；仅三种真人模式生效，每个分步滚动轮次结束后检测 DOM、布局和网络资源变化并等待稳定（默认 `false`）；与 `toBottom` 配合可持续加载无限列表
- `amount` (数字，可选)：滚动像素数（正数=下/右，负数=上/左）
- `direction` (字符串，可选)：`down` | `up` | `left` | `right`
- `steps` (数字，可选)：将像素滚动拆成多少步（fast 默认 `1`；真人模式 600px 基准为 `15` 步，并按 amount 等比计算；最多 `50`）；可强行传入覆盖
- `intervalMs` (数字，可选)：每步之间等待的毫秒数（fast 默认 `0`；human、humanFast、humanSlow 未传时恒定分别为 `50/20/80ms`，不随距离变化；最多 `2000`）；可强行传入覆盖
- `toBottom` (布尔值，可选)：滚动到容器底部；真人模式下按所选真人速度连续滚动，直到稳定到底部或本次请求达到上限
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
{ "mode": "human", "amount": 600 }
{ "mode": "humanFast", "amount": 600 }
{ "mode": "humanSlow", "amount": 600 }
{ "mode": "human", "amount": 600, "humanLazyLoad": true }
{ "mode": "human", "toBottom": true, "humanLazyLoad": true }
{ "amount": 1000, "direction": "down", "steps": 10, "intervalMs": 150 }
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

### `chrome_get_scroll_state`（上线时间：2026-07-17）

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

### `chrome_wait`（上线时间：2026-07-15）

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

### `chrome_extract`（上线时间：2026-07-15）

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

### `chrome_get_page_text`（上线时间：2026-07-15）

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

### `chrome_click_and_wait`（上线时间：2026-07-15）

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

### `chrome_spa_fetch`（上线时间：2026-07-29；since v1.6.3）

专为 SPA（单页应用）网站设计的内容提取工具。自动导航到目标 URL，等待 JavaScript 渲染完成，多次滚动到底部触发懒加载，然后提取完整的渲染文本。解决 X（推特）、Reddit 等 JS 重型页面用普通 HTTP 请求无法获取内容的问题。

适合场景：需要从动态渲染页面提取推文时间线、帖子列表、动态加载的文章内容等。

**参数**：

- `url` (字符串，必需)：目标 SPA 网址
- `maxScrolls` (数字，可选)：最大滚动次数（默认：5）。无限滚动页面（如推特时间线）建议设 10-15
- `scrollDelay` (数字，可选)：每次滚动后等待时间，毫秒（默认：2000）。给动态内容足够的渲染时间
- `waitForSelector` (字符串，可选)：等待特定 CSS 选择器出现后再开始提取。例如推特可以设为 `[data-testid="tweet"]`
- `waitTimeout` (数字，可选)：等待选择器的超时时间，毫秒（默认：20000）
- `extractHtml` (布尔值，可选)：是否同时返回渲染后的 HTML（默认：false）
- `tabId` (数字，可选)：指定已有标签页（默认：新建标签页）
- `windowId` (数字，可选)：目标窗口 ID

**示例**：

```json
{
  "url": "https://x.com/elonmusk",
  "maxScrolls": 10,
  "scrollDelay": 2500,
  "waitForSelector": "[data-testid=\"tweet\"]"
}
```

**响应**：

```json
{
  "success": true,
  "url": "https://x.com/elonmusk",
  "title": "Elon Musk (@elonmusk) / X",
  "scrollsPerformed": 8,
  "reachedMaxScrolls": false,
  "textContent": "渲染后的完整页面文本...",
  "article": {
    "title": "Elon Musk (@elonmusk) / X",
    "siteName": "X",
    "excerpt": "...",
    "lang": "en"
  }
}
```

### `chrome_select_all_items`（since v2.0.2）

对懒加载或虚拟列表执行安全的全选：滚动到底部，等待卡片数量连续稳定若干轮，再逐个操作每张卡片内的 checkbox。不依赖页面自身可能失效的"选择全部"按钮，也不把乐观 DOM 数量当成服务端操作成功。

**参数**：

- `cardSelector` (字符串，必需)：每个列表卡片的 CSS 选择器
- `checkboxSelector` (字符串，必需)：卡片内部 checkbox 的 CSS 选择器，如 `input[type="checkbox"]`
- `containerSelector` (字符串，可选)：滚动容器选择器（默认：页面滚动条）
- `step` (数字，可选)：每轮滚动像素（默认：500）
- `settleMs` (数字，可选)：每轮滚动后等待懒加载的毫秒数（默认：500）
- `stableRounds` (数字，可选)：底部连续稳定轮数（默认：3）
- `maxRounds` (数字，可选)：最大滚动轮数（默认：200）
- `maxDurationMs` (数字，可选)：最大执行时间（默认：120000 毫秒）
- `restoreScroll` (布尔值，可选)：完成后恢复原滚动位置（默认：false）
- `tabId` / `windowId` (数字，可选)：目标标签页/窗口

**示例**：

```json
{
  "cardSelector": ".product-card",
  "checkboxSelector": "input[type=\"checkbox\"]",
  "step": 500,
  "stableRounds": 3
}
```

**响应**：

```json
{
  "success": true,
  "cardsFound": 128,
  "selected": 128,
  "rounds": 42,
  "elapsedMs": 18500
}
```

### `collect_virtual_list`（上线时间：2026-08-10）

边滚动边从动态或虚拟列表中提取并去重记录。支持嵌套滚动容器、自适应等待、断点续采、分批结果和进度快照。

**参数**：

- `cardSelector`、`fields`、`identityFields`（必需）：卡片选择器、字段定义和去重字段
- `maxItems`（可选）：最多采集的记录数，默认 100
- `containerSelector` / `anchorSelector`（可选）：直接指定滚动容器，或指定容器内的锚点内容
- `scroll`（可选）：支持 `step`、`waitMs`、`waitTimeoutMs`、`settleMs`、`stalledLimit`、`rescanUp` 以及容器选择器
- `state`（可选）：传入上一次返回的 `state`，从 `scrollY` 和 `seenIds` 继续采集
- `returnBatches`、`batchSize`（可选）：返回分批结果
- `returnProgress`、`progressEverySteps`（可选）：返回滚动进度快照
- `tabId` 或 `windowId`（可选）：指定目标标签页；`windowId` 会选择该窗口的活动标签页

### `collect_virtual_lists`（上线时间：2026-08-10）

在多个标签页或窗口中并发执行同一采集任务，并按目标返回独立的结果、状态、进度、分批数据和失败原因。

**参数**：

- `targets`（必需）：目标数组，每项包含 `tabId` 或 `windowId`，也可覆盖 `frameSelector`、滚动容器、滚动参数和 `state`
- 单标签页采集的其他参数（根级 `tabId`、`windowId`、`state` 除外）
- `maxConcurrency`（可选）：最大并发目标数，默认 3，最大 8
- `failFast`（可选）：首个目标失败后停止启动新目标

调用方若在 MCP 请求的 `_meta.progressToken` 中提供令牌，且客户端支持 `notifications/progress`，采集过程中会实时收到进度通知；`returnProgress` 仍表示把进度快照放入最终结果。

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
await callTool('chrome_network_capture', {
  action: 'start',
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
const networkData = await callTool('chrome_network_capture', { action: 'stop' });

// 7. 保存书签
await callTool('chrome_bookmark_add', {
  title: '数据分析页面',
  parentId: '工作/分析',
});
```

此 API 提供全面的浏览器自动化功能，具有 AI 增强的内容分析和语义搜索特性。

## 🔄 Schema Catalog 补充

> 该部分由共享工具 schema 自动生成。

### `capture_debug_bundle`

将失败现场保存到下载目录：截图、DOM、控制台、脱敏网络摘要和元数据。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `resume_tab_task`

保存、读取或清除正常浏览器标签页的调用方状态；不会创建无痕窗口，也不会读取 Cookie。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_find_and_click`

在可选作用域内依次尝试 CSS、XPath 或文本候选项，点击第一个可见且可用的匹配元素。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_expand_section`

展开通用的折叠区域，并等待指定的内容选择器出现。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_scan_for_section`

滚动查找指定区域，可选择向上复扫；仅返回遍历状态，不包含平台业务规则。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_paginate_extract`

先抽取当前页，再点击指定的下一页候选项；仅在卡片 HTML 发生变化后继续。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_extract_records`

从卡片中抽取调用方指定的原始字段，并按不区分大小写的文本规则排除记录。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `detect_empty_state`

根据指定选择器和文本标记返回 has_content、empty 或 loading_or_unknown。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `merge_records`

按调用方提供的身份字段和数据源优先级纯数据合并；不读取浏览器状态，也不持久化。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_list_frames`

列出标签页中的框架，以便作用域操作通过 frameId 定位同源或跨域 iframe。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_diagnostic_snapshot`

返回标签页的一组诊断信息：视口截图、DOM 快照、控制台缓冲和当前网络捕获摘要。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_proxy_diagnostics`

读取代理配置及 Chrome 接管状态；action 为 test 时还会验证代理出口。不会返回用户名或密码。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_proxy_rotate`

当调用方确认当前标签页异常时，轮换代理会话并重新加载该页面。需要已启用代理；不会返回用户名或密码。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_scoped_action`

在一个语义作用域内点击、抽取或分页；支持开放的 Shadow DOM，并可用 frameId 指定同源或跨域 iframe。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_task_context`

创建隔离的无痕任务窗口，并在 MCP 重启后保存其标签页和调用方定义的抓取状态。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_create_tab`

新建浏览器标签页，可指定 URL、窗口、前台/后台状态和固定状态。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_hover`

通过 CSS 或 XPath 选择器将鼠标悬停在页面元素上。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_print_to_pdf`

使用 CDP Page.printToPDF 将页面打印为 PDF，支持页面 CSS 尺寸和自定义纸张尺寸。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_get_element_info`

查询页面元素的 attributes、computed styles 和 bounding rect。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_storage_get`

读取页面的 localStorage 或 sessionStorage。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_storage_set`

写入页面的 localStorage 或 sessionStorage；值会按 JSON 序列化。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_storage_delete`

删除页面的 localStorage 或 sessionStorage 键。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `performance_start_trace`

在所选页面上开始性能追踪记录；可选自动刷新页面和/或在短暂时间后自动停止。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `performance_stop_trace`

停止所选页面正在进行的性能追踪记录。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `performance_analyze_insight`

提供最近一次追踪记录的轻量摘要；如需深入洞察（CWV、明细），请集成原生侧 DevTools 追踪引擎。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_read_page`

获取页面上可见元素的无障碍树表示；仅返回视口中可见的元素，可选只筛选交互元素。\n提示：如果返回的元素不包含所需的具体元素，请使用 computer 工具的截图（action="screenshot"）获取该元素的屏幕坐标，再按坐标操作。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_computer`

使用鼠标和键盘与浏览器交互，并可截图。\n* 每当要点击图标等元素时，应先通过 read_page 确定该元素的 ref，再移动光标。\n* 如果点击程序或链接后等待很久仍未加载成功，先截图，再调整点击位置，使光标尖端视觉上落在要点击的元素上。\n* 点击按钮、链接、图标等时，务必让光标尖端位于元素中心，除非被要求，否则不要点击边缘。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_post_to_x`

在已登录的 X/Twitter 页面发布一条文本帖子。工具会等待编辑框、填充并回读验证文本、等待发布按钮可用、点击一次，然后等待新的成功标记。发布结果明确返回 published、failed 或 unknown；unknown 时不会自动重试，以避免重复发帖。支持自定义选择器以兼容 X 的页面变体。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_network_capture`

统一网络捕获工具。action="start" 开始，action="stop" 停止并返回结果；needResponseBody=true 时通过 Debugger API 获取响应体（可能与 DevTools 冲突），默认 webRequest 模式较轻量但不含响应体。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_block_resources`

在一个标签页中拦截指定资源类型或 URL 模式。请在导航或刷新前启动；停止后恢复加载。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_handle_download`

等待浏览器下载完成并返回详情（id、filename、url、state、size）

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_javascript`

在浏览器标签页中执行 JavaScript 代码并返回结果。使用 CDP Runtime.evaluate（awaitPromise + returnByValue）；调试器忙碌时自动回退到 chrome.scripting.executeScript。输出默认经过脱敏处理并截断。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_request_element_selection`

请求用户手动选择当前页面上的一个或多个元素。当使用 chrome_read_page 配合 chrome_click_element/chrome_fill_or_select/chrome_computer 尝试约 3 次仍无法可靠定位目标元素时，作为人工介入的回退方案。用户会看到带说明的面板并点击所需元素。返回与 chrome_click_element/chrome_fill_or_select 兼容的元素引用（含跨框架的 iframe frameId）。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_console`

采集浏览器标签页的控制台输出。支持快照模式（默认；一次性采集，约等待 2 秒）和缓冲模式（每个标签页的持久缓冲，可即时读取/清空，无需等待）。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_upload_file`

使用 Chrome DevTools Protocol 向带文件输入控件的网页表单上传文件

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_paste_image`

将本地图片或图片数据作为合成 paste 事件粘贴到 textarea、input 或 contenteditable 元素。它不读取系统剪贴板；内部使用临时 file input、DataTransfer 和 ClipboardEvent。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_get_form_value`

读取表单控件的实际 DOM value，适用于 React/Vue 受控 input 和 textarea；返回值不是 HTML 属性或文本节点。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_handle_dialog`

通过 CDP 处理 JavaScript 和 beforeunload 对话框（alert/confirm/prompt）

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_gif_recorder`

将浏览器标签页活动录制为 GIF 动画。\n\n模式：\n- 固定帧率模式（action="start"）：按固定间隔采集帧，适合动画/视频。\n- 自动采集模式（action="auto_start"）：chrome_computer 或 chrome_navigate 操作成功时自动采集帧，适合节奏自然的交互录制。\n\n使用 "stop" 结束录制并保存 GIF。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

### `chrome_paste_text`

向富文本编辑器合成粘贴多段文本（专治 Draft.js 系编辑器：知乎、Medium 等）。原理是给编辑器元素派发一个带 DataTransfer 的合成 ClipboardEvent("paste")，让编辑器走原生 paste 路径完整接收全部段落，且不依赖页面焦点（不读系统剪贴板）。替代 chrome_computer type（带换行会错乱）、execCommand insertText（多段只留最后一段）与剪贴板 API（无焦点被拒）。建议粘贴后刷新页面验证草稿完整，再点击发布按钮。

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。

## 🔄 Schema Catalog 补充

> 该部分由共享工具 schema 自动生成。

### `chrome_userscript`

管理浏览器用户脚本：创建、查询、启用、停用、更新、删除、导出脚本，或向已安装脚本发送命令。高风险工具，启用审批策略后需要显式批准。

**参数**：

- `action`（字符串，必需）：`create`、`list`、`get`、`enable`、`disable`、`update`、`remove`、`send_command` 或 `export`
- `args`（对象，可选）：操作参数，例如 `script`、`id`、`matches`、`world`、`mode`、`payload` 和 `tabId`

> 规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。
