<template>
  <div>
    <SelectorEditor :node="node" :allowPick="true" title="Start selector" targetKey="start" />
    <SelectorEditor :node="node" :allowPick="true" title="End selector" targetKey="end" />
    <div class="hint">
      <small
        >Tip: the path is usually generated automatically during recording; it can be left empty
        when creating manually.</small
      >
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
import SelectorEditor from './SelectorEditor.vue';

defineProps<{ node: NodeBase }>();
</script>

<style scoped>
.hint {
  color: #64748b;
  margin-top: 8px;
}
</style>
