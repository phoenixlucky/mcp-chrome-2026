/**
 * Web Editor V3 - Inject Script Entry Point
 *
 * This is the main entry point for the visual editor, injected into web pages
 * via chrome.scripting.executeScript from the background script.
 *
 * Architecture:
 * - Uses WXT's defineUnlistedScript for TypeScript compilation
 * - Exposes API on window.__MCP_WEB_EDITOR_V3__
 * - Communicates with background via chrome.runtime.onMessage
 *
 * Module structure:
 * - web-editor-v3/constants.ts - Configuration values
 * - web-editor-v3/utils/disposables.ts - Resource cleanup
 * - web-editor-v3/ui/shadow-host.ts - Shadow DOM isolation
 * - web-editor-v3/core/editor.ts - Main orchestrator
 * - web-editor-v3/core/message-listener.ts - Background communication
 *
 * Build output: .output/chrome-mv3/web-editor-v3.js
 */

import { WEB_EDITOR_V3_LOG_PREFIX } from './web-editor-v3/constants';
import { createWebEditorV3 } from './web-editor-v3/core/editor';
import { installMessageListener } from './web-editor-v3/core/message-listener';

export default defineUnlistedScript(() => {
  // Phase 1: Only support top frame
  // Phase 4 will add iframe support via content injection
  if (window !== window.top) {
    return;
  }

  // Singleton guard: prevent multiple instances
  if (window.__MCP_WEB_EDITOR_V3__) {
    console.log(`${WEB_EDITOR_V3_LOG_PREFIX} Already installed, skipping initialization`);
    return;
  }

  // Create and expose the API
  const api = createWebEditorV3();
  window.__MCP_WEB_EDITOR_V3__ = api;

  // Install message listener for background communication
  installMessageListener(api);

  console.log(`${WEB_EDITOR_V3_LOG_PREFIX} Installed successfully`);
});
