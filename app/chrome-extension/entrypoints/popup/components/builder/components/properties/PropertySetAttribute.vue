<template>
  <div>
    <SelectorEditor :node="node" :allowPick="true" />
    <div class="form-section">
      <div class="form-group">
        <label class="form-label">Attribute name</label>
        <input
          class="form-input"
          v-model="(node as any).config.name"
          placeholder="e.g. value/src/disabled"
        />
      </div>
      <div class="form-group">
        <label class="form-label">Attribute value (empty + checked remove deletes it)</label>
        <input
          class="form-input"
          v-model="(node as any).config.value"
          placeholder="Attribute value"
        />
      </div>
      <div class="form-group checkbox-group">
        <label class="checkbox-label"
          ><input type="checkbox" v-model="(node as any).config.remove" /> Remove attribute</label
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
