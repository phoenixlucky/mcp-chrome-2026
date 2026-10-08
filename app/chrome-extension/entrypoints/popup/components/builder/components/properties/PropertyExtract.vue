<template>
  <div class="form-section">
    <MarkerTargetPicker :node="node" targetKey="target" allowAll />
    <div class="form-group">
      <label class="form-label">Marker extract content</label>
      <select class="form-input" v-model="(node as any).config.markerValueType">
        <option value="text">Text</option>
        <option value="href">Link</option>
        <option value="src">Image URL</option>
        <option value="value">Input value</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Element selector (optional)</label>
      <input
        class="form-input"
        v-model="(node as any).config.selector"
        placeholder="CSS selector"
      />
    </div>
    <div class="form-group">
      <label class="form-label">Attribute</label>
      <input
        class="form-input"
        v-model="(node as any).config.attr"
        placeholder="text/textContent or attribute name"
      />
    </div>
    <div class="form-group">
      <label class="form-label">Custom JS (return value)</label>
      <textarea
        class="form-textarea"
        v-model="(node as any).config.js"
        rows="3"
        placeholder="return document.title"
      ></textarea>
    </div>
    <div class="form-group" :class="{ invalid: !(node as any).config?.saveAs }">
      <label class="form-label">Save as variable</label>
      <input class="form-input" v-model="(node as any).config.saveAs" placeholder="Variable name" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
import MarkerTargetPicker from './MarkerTargetPicker.vue';
defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
