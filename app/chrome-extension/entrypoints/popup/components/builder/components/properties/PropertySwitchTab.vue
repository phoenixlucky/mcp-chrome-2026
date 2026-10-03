<template>
  <div class="form-section">
    <div class="form-group">
      <label class="form-label">Tab ID (optional)</label>
      <input
        class="form-input"
        type="number"
        v-model.number="(node as any).config.tabId"
        placeholder="Number"
      />
    </div>
    <div class="form-group" :class="{ invalid: needOne && !hasAny }">
      <label class="form-label">URL contains (optional)</label>
      <input
        class="form-input"
        v-model="(node as any).config.urlContains"
        placeholder="Substring match"
      />
    </div>
    <div class="form-group" :class="{ invalid: needOne && !hasAny }">
      <label class="form-label">Title contains (optional)</label>
      <input
        class="form-input"
        v-model="(node as any).config.titleContains"
        placeholder="Substring match"
      />
    </div>
    <div
      v-if="needOne && !hasAny"
      class="text-xs text-slate-500"
      style="padding: 0 20px; color: var(--rr-danger)"
      >Provide a tabId or a URL/title contains match</div
    >
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';

const props = defineProps<{ node: NodeBase }>();
const needOne = true;
const hasAny = computed(() => {
  const c: any = (props.node as any).config || {};
  return !!(c.tabId || c.urlContains || c.titleContains);
});
</script>

<style scoped></style>
