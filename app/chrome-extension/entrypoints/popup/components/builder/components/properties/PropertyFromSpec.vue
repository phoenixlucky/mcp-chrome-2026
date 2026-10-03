<template>
  <PropertyFormRenderer v-if="node && hasSpec" :node="node" :variables="variables" />
  <div v-else class="form-section">
    <div class="section-title">Node spec not found</div>
    <div class="help"
      >This node has no NodeSpec yet; falling back to the default property panel.</div
    >
  </div>
  <!-- Leave common fields to the outer PropertyPanel (timeoutMs/screenshotOnFail, etc.) -->
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import PropertyFormRenderer from './PropertyFormRenderer.vue';
import { getNodeSpec } from '@/entrypoints/popup/components/builder/model/node-spec-registry';
import type { VariableOption } from '@/entrypoints/popup/components/builder/model/variables';

const props = defineProps<{
  node: any;
  variables?: VariableOption[];
}>();
const hasSpec = computed(() => !!getNodeSpec(props.node?.type));
</script>

<style scoped>
.form-section {
  padding: 8px 12px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--rr-text);
  margin-bottom: 6px;
}
.help {
  font-size: 12px;
  color: var(--rr-dim);
}
</style>
