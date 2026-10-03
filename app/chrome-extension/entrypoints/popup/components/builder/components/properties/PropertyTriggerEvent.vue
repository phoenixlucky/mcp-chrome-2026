<template>
  <div>
    <SelectorEditor :node="node" :allowPick="true" />
    <div class="form-section">
      <div class="form-group">
        <label class="form-label">Event type</label>
        <input
          class="form-input"
          v-model="(node as any).config.event"
          placeholder="e.g. input/change/mouseover"
        />
      </div>
      <div class="form-group checkbox-group">
        <label class="checkbox-label"
          ><input type="checkbox" v-model="(node as any).config.bubbles" /> Bubbles</label
        >
        <label class="checkbox-label"
          ><input type="checkbox" v-model="(node as any).config.cancelable" /> Cancelable</label
        >
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
import SelectorEditor from './SelectorEditor.vue';

defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
