<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
    :class="className"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8"
    />
    <path stroke-linecap="round" stroke-linejoin="round" d="M14 2v5h5M8 10h5M8 14h3" />
    <circle cx="17" cy="17" r="4" />
    <path stroke-linecap="round" d="M17 15.5v2M17 19h.01" />
  </svg>
</template>

<script lang="ts" setup>
interface Props {
  className?: string;
}

withDefaults(defineProps<Props>(), {
  className: 'icon-default',
});
</script>
