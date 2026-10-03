<template>
  <div class="form-section">
    <div class="form-group">
      <label class="form-label">URL (optional)</label>
      <input
        class="form-input"
        v-model="(node as any).config.url"
        placeholder="https://example.com"
      />
    </div>
    <div class="form-group checkbox-group">
      <label class="checkbox-label"
        ><input type="checkbox" v-model="(node as any).config.newWindow" /> New window</label
      >
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
