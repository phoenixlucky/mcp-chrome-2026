<template>
  <div class="form-section">
    <div class="form-group">
      <label class="form-label">Key sequence</label>
      <input
        class="form-input"
        v-model="(node as any).config.keys"
        placeholder="e.g. Backspace Enter or cmd+a"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
