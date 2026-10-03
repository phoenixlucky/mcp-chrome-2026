<template>
  <div class="form-section">
    <div class="form-group">
      <label class="form-label">Filename contains (optional)</label>
      <input
        class="form-input"
        v-model="(node as any).config.filenameContains"
        placeholder="Substring-match filename or URL"
      />
    </div>
    <div class="form-group">
      <label class="form-label">Timeout (ms)</label>
      <input
        class="form-input"
        v-model="(node as any).config.timeoutMs"
        placeholder="Default: 60000"
      />
    </div>
    <div class="form-group checkbox-group">
      <label class="checkbox-label"
        ><input type="checkbox" v-model="(node as any).config.waitForComplete" /> Wait for download
        to complete</label
      >
    </div>
    <div class="form-group">
      <label class="form-label">Save to variable</label>
      <input
        class="form-input"
        v-model="(node as any).config.saveAs"
        placeholder="Default: download"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
