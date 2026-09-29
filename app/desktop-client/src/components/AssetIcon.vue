<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';

const iconFiles = {
  activity: 'activity',
  alert: 'alert',
  browser: 'browser',
  box: 'box',
  cable: 'cable',
  cat: 'cat',
  close: 'close',
  'check-circle': 'check-circle',
  'chevron-right': 'chevron-right',
  clipboard: 'clipboard',
  copy: 'copy',
  crosshair: 'crosshair',
  file: 'file',
  globe: 'globe',
  home: 'home',
  link: 'link',
  lock: 'lock',
  message: 'message',
  network: 'network',
  pause: 'pause',
  play: 'play',
  plug: 'plug',
  radio: 'radio',
  refresh: 'refresh',
  'search-check': 'search-check',
  server: 'server',
  settings: 'settings',
  sliders: 'sliders',
  terminal: 'terminal',
  trash: 'trash',
  wrench: 'wrench',
} as const;

type IconName = keyof typeof iconFiles;

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 });
const style = computed<CSSProperties>(() => {
  const src = `/assets/icons/${iconFiles[props.name]}.png`;
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    maskImage: `url("${src}")`,
    WebkitMaskImage: `url("${src}")`,
  };
});
</script>

<template>
  <span class="asset-icon" :style="style" aria-hidden="true"></span>
</template>

<style scoped>
.asset-icon {
  display: inline-block;
  flex: 0 0 auto;
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  vertical-align: middle;
}
</style>
