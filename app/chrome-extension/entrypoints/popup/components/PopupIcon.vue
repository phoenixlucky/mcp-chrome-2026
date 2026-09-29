<script setup lang="ts">
import type { PopupIconName } from './popup-icons';

const props = defineProps<{
  name: PopupIconName;
  label?: string;
}>();
</script>

<template>
  <img
    class="popup-icon"
    :src="`/assets/icons/${props.name}.png`"
    :alt="props.label ?? ''"
    :aria-hidden="props.label ? undefined : 'true'"
    draggable="false"
  />
</template>

<style scoped>
.popup-icon {
  display: block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  object-fit: contain;
  image-rendering: auto;
  pointer-events: none;
  user-select: none;
}

:global(.back-arrow-icon) {
  width: 18px;
  height: 18px;
  transform: rotate(180deg);
}
</style>
