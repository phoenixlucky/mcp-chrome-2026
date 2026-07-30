<template>
  <div class="flex min-w-0 w-full items-center gap-2">
    <!-- Brand / Context -->
    <div class="flex min-w-0 flex-1 items-center gap-1.5 -ml-1">
      <!-- Back Button (when in chat view) -->
      <button
        v-if="showBackButton"
        class="flex items-center justify-center w-8 h-8 flex-shrink-0 ac-btn"
        :style="{
          color: 'var(--ac-text-muted)',
          borderRadius: 'var(--ac-radius-button)',
        }"
        :title="copy.backToSessions"
        @click="$emit('back')"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <!-- Brand -->
      <h1
        class="max-w-[100px] flex-shrink-0 truncate text-base font-medium tracking-tight"
        :style="{
          fontFamily: 'var(--ac-font-heading)',
          color: 'var(--ac-text)',
        }"
      >
        {{ brandLabel || 'Agent' }}
      </h1>

      <!-- Divider -->
      <div
        class="h-4 w-[1px] flex-shrink-0"
        :style="{ backgroundColor: 'var(--ac-border-strong)' }"
      />

      <!-- Project Breadcrumb -->
      <button
        class="flex min-w-0 max-w-[72px] items-center gap-1 px-1.5 py-1 text-xs group ac-btn"
        :style="{
          fontFamily: 'var(--ac-font-mono)',
          color: 'var(--ac-text-muted)',
          borderRadius: 'var(--ac-radius-button)',
        }"
        :title="projectLabel"
        @click="$emit('toggle:projectMenu')"
      >
        <span class="min-w-0 truncate">{{ projectLabel }}</span>
        <svg
          class="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <!-- Session Breadcrumb -->
      <div class="h-3 w-[1px] flex-shrink-0" :style="{ backgroundColor: 'var(--ac-border)' }" />
      <button
        class="flex min-w-0 flex-1 items-center gap-1 px-1.5 py-1 text-xs group ac-btn"
        :style="{
          fontFamily: 'var(--ac-font-mono)',
          color: 'var(--ac-text-subtle)',
          borderRadius: 'var(--ac-radius-button)',
        }"
        :title="sessionLabel"
        @click="$emit('toggle:sessionMenu')"
      >
        <span class="min-w-0 truncate">{{ sessionLabel }}</span>
        <svg
          class="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>

    <!-- Connection / Status / Settings -->
    <div class="ml-auto flex flex-none items-center gap-1">
      <!-- Connection Indicator -->
      <div class="flex items-center gap-1.5" :title="connectionText">
        <span
          class="w-2 h-2 rounded-full"
          :style="{
            backgroundColor: connectionColor,
            boxShadow: connectionState === 'ready' ? `0 0 8px ${connectionColor}` : 'none',
          }"
        />
      </div>

      <!-- Open Project Button -->
      <button
        class="p-1 ac-btn ac-hover-text"
        :style="{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }"
        :title="copy.openProject"
        @click="$emit('toggle:openProjectMenu')"
      >
        <svg
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </button>

      <!-- Theme & Settings Icon (Color Palette) -->
      <button
        class="p-1 ac-btn ac-hover-text"
        :style="{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }"
        @click="$emit('toggle:settingsMenu')"
      >
        <svg
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path
            d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useAgentLocale } from '../../composables/useAgentLocale';

export type ConnectionState = 'ready' | 'connecting' | 'disconnected';

const props = defineProps<{
  projectLabel: string;
  sessionLabel: string;
  connectionState: ConnectionState;
  /** Whether to show back button (for returning to sessions list) */
  showBackButton?: boolean;
  /** Brand label to display (e.g., "Claude Code", "Codex") */
  brandLabel?: string;
}>();

const { isChinese } = useAgentLocale();
const copy = computed(() =>
  isChinese.value
    ? { backToSessions: '返回会话列表', openProject: '在 VS Code 或终端中打开项目' }
    : { backToSessions: 'Back to sessions', openProject: 'Open project in VS Code or Terminal' },
);

defineEmits<{
  'toggle:projectMenu': [];
  'toggle:sessionMenu': [];
  'toggle:settingsMenu': [];
  'toggle:openProjectMenu': [];
  /** Emitted when back button is clicked */
  back: [];
}>();

const connectionColor = computed(() => {
  switch (props.connectionState) {
    case 'ready':
      return 'var(--ac-success)';
    case 'connecting':
      return 'var(--ac-warning)';
    default:
      return 'var(--ac-text-subtle)';
  }
});

const connectionText = computed(() => {
  switch (props.connectionState) {
    case 'ready':
      return isChinese.value ? '已连接' : 'Connected';
    case 'connecting':
      return isChinese.value ? '连接中…' : 'Connecting...';
    default:
      return isChinese.value ? '未连接' : 'Disconnected';
  }
});
</script>
