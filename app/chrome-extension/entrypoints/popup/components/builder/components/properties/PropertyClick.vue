<template>
  <div>
    <SelectorEditor :node="node" :allowPick="true" />
  </div>
</template>

<script lang="ts" setup>

import type { NodeBase } from '@/entrypoints/background/record-replay-v3/builder-types';
import SelectorEditor from './SelectorEditor.vue';

defineProps<{ node: NodeBase }>();
</script>

<style scoped></style>
