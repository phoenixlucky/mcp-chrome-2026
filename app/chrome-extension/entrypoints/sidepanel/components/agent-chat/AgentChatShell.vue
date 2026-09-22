<template>
  <div ref="shellRef" class="h-full flex flex-col overflow-hidden relative">
    <!-- Header -->
    <header
      class="flex-none px-3 py-2 flex items-center justify-between z-20"
      :style="{
        backgroundColor: 'var(--ac-header-bg)',
        borderBottom: 'var(--ac-border-width) solid var(--ac-header-border)',
        backdropFilter: 'blur(8px)',
      }"
    >
      <slot name="header" />
    </header>

    <!-- Content Area -->
    <main
      ref="contentRef"
      class="flex-1 overflow-y-auto ac-scroll"
      :style="{
        paddingBottom: composerHeight + 'px',
      }"
      @scroll="handleScroll"
    >
      <!-- Stable wrapper for ResizeObserver -->
      <div ref="contentSlotRef">
        <slot name="content" />
      </div>
    </main>

    <!-- Footer / Composer -->
    <footer
      ref="composerRef"
      class="flex-none px-5 pb-5 pt-2"
      :style="{
        background: `linear-gradient(to top, var(--ac-bg), var(--ac-bg), transparent)`,
      }"
    >
      <!-- Error Banner (above input) -->
      <div
        v-if="errorMessage || errorInfo"
        class="mb-2 px-4 py-2 text-xs rounded-lg flex items-start gap-2"
        :style="{
          backgroundColor: 'var(--ac-diff-del-bg)',
          color: 'var(--ac-danger)',
          border: 'var(--ac-border-width) solid var(--ac-diff-del-border)',
          borderRadius: 'var(--ac-radius-inner)',
        }"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <div class="font-medium">
            {{ errorInfo?.userMessage || errorMessage }}
          </div>
          <div v-if="errorInfo" class="text-[10px] opacity-75">
            {{ labelForError(errorInfo, isChinese) }}
          </div>
          <details v-if="errorInfo" :open="showErrorDetails" class="mt-1">
            <summary
              class="cursor-pointer select-none text-[10px] opacity-80"
              @click.prevent="showErrorDetails = !showErrorDetails"
            >
              {{ showErrorDetails ? copy.hideDetails : copy.details }}
            </summary>
            <div
              v-if="showErrorDetails"
              class="mt-1 whitespace-pre-wrap break-all ac-scroll opacity-80"
              :style="{ maxHeight: '20vh', overflowY: 'auto', overflowWrap: 'anywhere' }"
            >
              <div v-if="errorInfo.technicalMessage">{{ errorInfo.technicalMessage }}</div>
              <div v-if="errorInfo.code">Code: {{ errorInfo.code }}</div>
              <div v-if="errorInfo.requestId">Request: {{ errorInfo.requestId }}</div>
              <div v-if="errorInfo.toolName">Tool: {{ errorInfo.toolName }}</div>
            </div>
          </details>
          <div class="flex flex-wrap gap-2 pt-1">
            <button
              v-if="canRetry"
              type="button"
              class="ac-btn ac-focus-ring cursor-pointer rounded px-2 py-1"
              :style="{ backgroundColor: 'var(--ac-danger)', color: 'white' }"
              @click="emit('error:retry')"
            >
              {{ copy.retry }}
            </button>
            <button
              v-if="errorInfo"
              type="button"
              class="ac-btn ac-focus-ring cursor-pointer rounded px-2 py-1"
              :style="{ color: 'var(--ac-danger)' }"
              @click="emit('error:copy')"
            >
              {{ diagnosticsCopied ? copy.copied : copy.copy }}
            </button>
          </div>
        </div>

        <!-- Dismiss button -->
        <button
          type="button"
          class="p-1 flex-shrink-0 ac-btn ac-focus-ring cursor-pointer"
          :style="{
            color: 'var(--ac-danger)',
            borderRadius: 'var(--ac-radius-button)',
          }"
          :aria-label="copy.dismiss"
          :title="copy.dismiss"
          @click="emit('error:dismiss')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <slot name="composer" />

      <!-- Usage & Version label -->
      <div
        class="text-[10px] text-center mt-2 font-medium tracking-wide flex items-center justify-center gap-2"
        :style="{ color: 'var(--ac-text-subtle)' }"
      >
        <template v-if="usage">
          <span
            :title="`Input: ${usage.inputTokens.toLocaleString()}, Output: ${usage.outputTokens.toLocaleString()}`"
          >
            {{ formatTokens(usage.inputTokens + usage.outputTokens) }} {{ copy.tokens }}
          </span>
          <span class="opacity-50">·</span>
          <span
            :title="`Duration: ${(usage.durationMs / 1000).toFixed(1)}s, Turns: ${usage.numTurns}`"
          >
            ${{ usage.totalCostUsd.toFixed(4) }}
          </span>
          <span class="opacity-50">·</span>
        </template>
        <span>{{ footerLabel || 'Agent Preview' }}</span>
      </div>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { AgentErrorInfo, AgentUsageStats } from '@ethanwilkins/chrome-mcp-shared-2026';
import { useAgentLocale } from '../../composables/useAgentLocale';

defineProps<{
  errorMessage?: string | null;
  errorInfo?: AgentErrorInfo | null;
  canRetry?: boolean;
  diagnosticsCopied?: boolean;
  usage?: AgentUsageStats | null;
  /** Footer label to display (e.g., "Claude Code Preview", "Codex Preview") */
  footerLabel?: string;
}>();

const emit = defineEmits<{
  /** Emitted when user clicks dismiss button on error banner */
  'error:dismiss': [];
  'error:retry': [];
  'error:copy': [];
}>();

const { isChinese } = useAgentLocale();
const showErrorDetails = ref(false);
const copy = computed(() =>
  isChinese.value
    ? {
        dismiss: '关闭错误提示',
        tokens: '个词元',
        retry: '重试',
        details: '详情',
        hideDetails: '收起详情',
        copy: '复制诊断',
        copied: '已复制',
      }
    : {
        dismiss: 'Dismiss error',
        tokens: 'tokens',
        retry: 'Retry',
        details: 'Details',
        hideDetails: 'Hide details',
        copy: 'Copy diagnostics',
        copied: 'Copied',
      },
);

function labelForError(info: AgentErrorInfo, chinese: boolean): string {
  const labels: Record<string, [string, string]> = {
    connection: ['连接', 'Connection'],
    request: ['请求', 'Request'],
    engine: ['模型', 'Model'],
    tool: ['工具', 'Tool'],
    timeout: ['超时', 'Timeout'],
    cancelled: ['已取消', 'Cancelled'],
    unknown: ['未知', 'Unknown'],
  };
  const phases: Record<string, [string, string]> = {
    connection: ['连接阶段', 'Connection'],
    dispatch: ['提交阶段', 'Dispatch'],
    model: ['模型执行', 'Model execution'],
    tool: ['工具执行', 'Tool execution'],
    stream: ['流式传输', 'Streaming'],
    cancel: ['取消操作', 'Cancellation'],
  };
  const category = labels[info.category] ?? labels.unknown;
  const phase = phases[info.phase] ?? phases.stream;
  return `${chinese ? category[0] : category[1]} · ${chinese ? phase[0] : phase[1]}`;
}

/**
 * Format token count for display (e.g., 1.2k, 3.5M)
 */
function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1) + 'M';
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1) + 'k';
  }
  return count.toString();
}

const shellRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const contentSlotRef = ref<HTMLElement | null>(null);
const composerRef = ref<HTMLElement | null>(null);
const composerHeight = ref(120); // Default height

// Auto-scroll state
const isUserScrolledUp = ref(false);
// Threshold should account for padding and some tolerance
const SCROLL_THRESHOLD = 150;
type ScrollBehaviorValue = 'auto' | 'instant' | 'smooth';

/**
 * Check if scroll position is near bottom
 */
function isNearBottom(el: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el;
  return scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
}

/**
 * Handle user scroll to track if they've scrolled up
 */
function handleScroll(): void {
  if (!contentRef.value) return;
  isUserScrolledUp.value = !isNearBottom(contentRef.value);
}

/**
 * Scroll to bottom of content area
 */
function scrollToBottom(behavior: ScrollBehaviorValue = 'smooth'): void {
  if (!contentRef.value) return;
  contentRef.value.scrollTo({
    top: contentRef.value.scrollHeight,
    behavior,
  });
}

// Observers
let composerResizeObserver: ResizeObserver | null = null;
let contentResizeObserver: ResizeObserver | null = null;

// Scroll scheduling to prevent excessive calls during streaming
let scrollScheduled = false;

/**
 * Auto-scroll when content or composer changes (if user is at bottom)
 * Uses requestAnimationFrame to debounce rapid updates during streaming
 */
function maybeAutoScroll(): void {
  if (scrollScheduled || isUserScrolledUp.value || !contentRef.value) {
    return;
  }
  scrollScheduled = true;
  requestAnimationFrame(() => {
    scrollScheduled = false;
    if (!isUserScrolledUp.value) {
      scrollToBottom('auto');
    }
  });
}

onMounted(() => {
  // Observe composer height changes
  if (composerRef.value) {
    composerResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        composerHeight.value = entry.contentRect.height + 24; // Add padding
      }
      // Also auto-scroll when composer height changes (e.g., error banner appears)
      maybeAutoScroll();
    });
    composerResizeObserver.observe(composerRef.value);
  }

  // Observe content height changes for auto-scroll using stable wrapper
  if (contentSlotRef.value) {
    contentResizeObserver = new ResizeObserver(() => {
      maybeAutoScroll();
    });
    contentResizeObserver.observe(contentSlotRef.value);
  }
});

onUnmounted(() => {
  composerResizeObserver?.disconnect();
  contentResizeObserver?.disconnect();
});

// Expose scrollToBottom for parent component to call
defineExpose({
  scrollToBottom,
});
</script>
