import { createApp } from 'vue';
import { NativeMessageType } from '@ethanwilkins/chrome-mcp-shared-2026';
import './style.css';
// Import AgentChat theme styles
import '../sidepanel/styles/agent-chat.css';
import { preloadAgentTheme } from '../sidepanel/composables/useAgentTheme';
import App from './App.vue';

// Preload the theme before mounting Vue to prevent theme flicker
preloadAgentTheme().then(() => {
  // Trigger ensure native connection (fire-and-forget, don't block UI mounting)
  void chrome.runtime.sendMessage({ type: NativeMessageType.ENSURE_NATIVE }).catch(() => {
    // Silent failure - background will handle reconnection
  });
  createApp(App).mount('#app');
});
