<template>
  <div class="px-5 py-6 space-y-8">
    <!-- Empty State -->
    <div v-if="threads.length === 0" class="py-10 text-center">
      <p
        class="text-2xl italic opacity-40"
        :style="{
          fontFamily: 'var(--ac-font-heading)',
          color: 'var(--ac-text-subtle)',
        }"
      >
        {{ emptyText }}
      </p>
    </div>

    <!-- Request Threads -->
    <AgentRequestThread v-for="thread in threads" :key="thread.id" :thread="thread" />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { AgentThread } from '../../composables/useAgentThreads';
import { useAgentLocale } from '../../composables/useAgentLocale';
import AgentRequestThread from './AgentRequestThread.vue';

defineProps<{
  threads: AgentThread[];
}>();

const { isChinese } = useAgentLocale();
const emptyText = computed(() =>
  isChinese.value ? '今天想让我帮你做什么呢？' : 'How can I help you code today?',
);
</script>
