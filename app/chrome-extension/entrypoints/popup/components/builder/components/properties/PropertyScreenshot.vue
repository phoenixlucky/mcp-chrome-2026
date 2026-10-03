<template>
  <div class="form-section">
    <div class="form-group">
      <label class="form-label">Element selector (optional)</label>
      <input
        class="form-input"
        v-model="(node as any).config.selector"
        placeholder="Empty captures the viewport or full page"
      />
    </div>
    <div class="form-group checkbox-group">
      <label class="checkbox-label"
        ><input type="checkbox" v-model="(node as any).config.fullPage" /> Full-page
        screenshot</label
      >
    </div>
    <div class="form-group">
      <label class="form-label">Save as variable</label>
      <input
        class="form-input"
        v-model="(node as any).config.saveAs"
        placeholder="Variable name, e.g. shot"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
