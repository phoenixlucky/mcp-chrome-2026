<template>
  <div class="form-section">
    <div class="form-group">
      <label class="form-label">Match by URL contains (preferred)</label>
      <input
        class="form-input"
        v-model="(node as any).config.frame.urlContains"
        placeholder="String contained in the frame URL"
      />
    </div>
    <div class="form-group">
      <label class="form-label">Match by index (0-based, child frames only)</label>
      <input
        class="form-input"
        v-model="(node as any).config.frame.index"
        placeholder="Index number"
      />
    </div>
    <div class="text-xs text-slate-500" style="padding: 0 20px"
      >Same-origin/injectable frames only; leave empty to return to the top-level page</div
    >
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
