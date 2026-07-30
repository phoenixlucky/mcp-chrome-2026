<template>
  <div
    v-if="open"
    class="fixed top-12 right-4 z-50 min-w-[180px] py-2"
    :style="{
      backgroundColor: 'var(--ac-surface, #ffffff)',
      border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      borderRadius: 'var(--ac-radius-inner, 8px)',
      boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
    }"
  >
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      {{ copy.language }}
    </div>
    <button
      class="w-full px-3 py-2 text-left text-sm flex items-center justify-between ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('locale:set', locale === 'zh' ? 'en' : 'zh')"
    >
      <span>{{ copy.switchLanguage }}</span>
      <span>{{ locale === 'zh' ? 'EN' : '中文' }}</span>
    </button>

    <div
      class="my-2"
      :style="{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }"
    />

    <!-- Theme Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      {{ copy.theme }}
    </div>

    <button
      v-for="t in themes"
      :key="t.id"
      class="w-full px-3 py-2 text-left text-sm flex items-center justify-between ac-menu-item"
      :style="{
        color: theme === t.id ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
      }"
      @click="$emit('theme:set', t.id)"
    >
      <span>{{ t.label }}</span>
      <svg
        v-if="theme === t.id"
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{
        borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      }"
    />

    <!-- Input Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      {{ copy.input }}
    </div>

    <button
      class="w-full px-3 py-2 text-left text-sm flex items-center justify-between ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('fakeCaret:toggle', !fakeCaretEnabled)"
    >
      <span>{{ copy.cometCaret }}</span>
      <svg
        v-if="fakeCaretEnabled"
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{
        borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      }"
    />

    <!-- Storage Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      {{ copy.storage }}
    </div>

    <button
      class="w-full px-3 py-2 text-left text-sm ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('attachments:open')"
    >
      {{ copy.clearAttachmentCache }}
    </button>

    <button
      class="w-full px-3 py-2 text-left text-sm ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('deepseek:open')"
    >
      {{ copy.deepSeekSettings }}
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{
        borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      }"
    />

    <!-- Reconnect -->
    <button
      class="w-full px-3 py-2 text-left text-sm ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('reconnect')"
    >
      {{ copy.reconnectServer }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { type AgentThemeId, THEME_LABELS } from '../../composables';

type Locale = 'zh' | 'en';

const props = defineProps<{
  open: boolean;
  theme: AgentThemeId;
  locale: Locale;
  /** Fake caret (comet effect) enabled state */
  fakeCaretEnabled?: boolean;
}>();

defineEmits<{
  'theme:set': [theme: AgentThemeId];
  'locale:set': [locale: Locale];
  reconnect: [];
  'attachments:open': [];
  'deepseek:open': [];
  'fakeCaret:toggle': [enabled: boolean];
}>();

const copy = computed(() =>
  props.locale === 'zh'
    ? {
        language: '语言',
        switchLanguage: '切换为 English',
        theme: '主题',
        input: '输入',
        cometCaret: '彗星光标',
        storage: '存储',
        clearAttachmentCache: '清除附件缓存',
        deepSeekSettings: 'DeepSeek API 设置',
        reconnectServer: '重新连接服务',
      }
    : {
        language: 'Language',
        switchLanguage: 'Switch to Chinese',
        theme: 'Theme',
        input: 'Input',
        cometCaret: 'Comet caret',
        storage: 'Storage',
        clearAttachmentCache: 'Clear Attachment Cache',
        deepSeekSettings: 'DeepSeek API Settings',
        reconnectServer: 'Reconnect Server',
      },
);

const themes: { id: AgentThemeId; label: string }[] = [
  { id: 'warm-editorial', label: THEME_LABELS['warm-editorial'] },
  { id: 'blueprint-architect', label: THEME_LABELS['blueprint-architect'] },
  { id: 'zen-journal', label: THEME_LABELS['zen-journal'] },
  { id: 'neo-pop', label: THEME_LABELS['neo-pop'] },
  { id: 'dark-console', label: THEME_LABELS['dark-console'] },
  { id: 'swiss-grid', label: THEME_LABELS['swiss-grid'] },
];
</script>
