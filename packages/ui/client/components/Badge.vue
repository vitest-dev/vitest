<script setup lang="ts">
const { type = 'info' } = defineProps<{
  type?: 'danger' | 'warning' | 'info' | 'tip' | 'custom'
}>()
</script>

<template>
  <span
    class="rounded-full py-0.5 px-2 text-xs text-white select-none"
    :class="{
      'bg-red': type === 'danger',
      'bg-orange': type === 'warning',
      'bg-gray': type === 'info',
      'bg-indigo/60': type === 'tip',
    }"
  >
    <slot />
  </span>
</template>
