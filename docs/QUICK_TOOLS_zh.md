# Quick Tools Guide

## Popup quick tools

Click the extension toolbar icon and use the two page-level tools in the **Quick Tools** section.

### Enable Page Editing Mode

The page editor lets you **locate and adjust UI visually** on the current page. Select an element to inspect its properties, adjust size/layout/styles, then send a request such as “make this button larger” to the Smart Assistant with that element context. The assistant changes source code; the editor does not publish a website by itself.

- Open it from the popup edit icon, the **Toggle Web Editing Mode** page context-menu item, or `Ctrl/Cmd + Shift + O`.
- Use it for local UI tuning, prototype validation, and precise component targeting with Claude or Codex.
- See the [Visual Editor guide](VisualEditor.md) for more detail.

### Enable Element Marking

Element Marking saves important page elements as named selectors, such as “product price”, “submit button”, or “review list”. You can search, edit, and delete them in **Element Marker Management**. Matching markers are included first when MCP reads a page, making assistant targeting more reliable.

- Open it from the popup marker icon or the **Mark element** page context-menu item.
- Use it for pages you repeatedly collect from or operate, and for explicitly identifying important fields and controls to an AI assistant.
- Markers are stored in the extension's local IndexedDB and matched by page origin and path; recheck a selector after a page structure change.

## Page Quick Panel

Press `Ctrl + Shift + U` on any page (`Cmd + Shift + U` on macOS) to open or close the Quick Panel.

1. Create and select a session in the Smart Assistant side panel first.
2. Open the page Quick Panel; it automatically includes the current page URL and selected page text.
3. Press Enter to send and Esc to close. You can cancel while a streamed reply is in progress.

When no assistant session is selected, the extension opens the side panel and asks you to select or create one. A request can wait for up to 15 minutes; retry from the side panel after a timeout or connection error.

## Popup MCP Tool Catalog

Click the extension toolbar icon and open **MCP Tools**:

- Search by tool name or description.
- Expand an item to inspect parameters, required flags, and descriptions.
- This is a browse-only catalog; it **does not execute tools**. Use an MCP-compatible client to invoke them.

For complete tool parameters and examples, see the [Tool API Reference](TOOLS.md).
