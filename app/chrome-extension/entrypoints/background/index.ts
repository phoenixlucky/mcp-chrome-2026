import { initNativeHostListener } from './native-host';
import { initSemanticSimilarityListener } from './semantic-similarity-router';
import { initStorageManagerListener } from './storage-manager';
import { cleanupModelCache, hasAnyModelCache } from '@/utils/model-cache-lifecycle';
import { initElementMarkerListeners } from './element-marker';
import { initWebEditorListeners } from './web-editor';
import { initQuickPanelAgentHandler } from './quick-panel/agent-handler';
import { initQuickPanelCommands } from './quick-panel/commands';
import { initQuickPanelTabsHandler } from './quick-panel/tabs-handler';
import { initErrorLog } from './error-log';
import { initProxyManager } from './proxy';
import { initContextActionListeners } from './context-actions';

import { bootstrapV3 } from './record-replay-v3/bootstrap';
import { initPageRecorder } from './record-replay-v3/page-recorder';

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  initErrorLog();
  initProxyManager();
  // Open welcome page on first install
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      // Open the welcome/onboarding page for new installations
      chrome.tabs.create({
        url: chrome.runtime.getURL('/welcome.html'),
      });
    }
  });

  // Initialize core services
  initNativeHostListener();
  initSemanticSimilarityListener();
  initStorageManagerListener();
  bootstrapV3()
    .then((runtime) => {
      console.log(`[RR-V3] Bootstrap complete, ownerId: ${runtime.ownerId}`);
    })
    .catch((error) => {
      console.error('[RR-V3] Bootstrap failed:', error);
    });
  initPageRecorder();

  // Element marker: context menu + CRUD listeners
  initElementMarkerListeners();
  // Right-click convenience action: copy the entire page text
  initContextActionListeners();
  // Web editor: toggle edit-mode overlay
  initWebEditorListeners();
  // Quick Panel: send messages to AgentChat via background-stream bridge
  initQuickPanelAgentHandler();
  // Quick Panel: tabs search bridge for content script UI
  initQuickPanelTabsHandler();
  // Quick Panel: keyboard shortcut handler
  initQuickPanelCommands();

  // Conditionally initialize semantic similarity engine if model cache exists
  hasAnyModelCache()
    .then(async (initialized) => {
      if (!initialized) {
        console.log(
          'Background: Semantic similarity engine initialization skipped (no cache found)',
        );
        return;
      }

      await import('./semantic-similarity').then(({ initializeDefaultSemanticEngine }) =>
        initializeDefaultSemanticEngine(),
      );
      console.log('Background: Semantic similarity engine initialized from cache');
    })
    .catch((error) => {
      console.warn('Background: Failed to conditionally initialize semantic engine:', error);
    });

  // Initial cleanup on startup
  cleanupModelCache().catch((error) => {
    console.warn('Background: Initial cache cleanup failed:', error);
  });
});
