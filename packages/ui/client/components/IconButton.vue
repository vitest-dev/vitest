<script setup lang="ts">
defineProps<{ icon?: string; title?: string }>()
</script>

<template>
  <button :aria-label="title" role="button" op70 rounded hover="bg-active op100" class="w-1.4em h-1.4em flex">
    <slot>
      <div :class="icon" ma />
    </slot>
  </button>
</template>
