<script setup lang="ts">
defineProps<{ icon?: `i-${string}` | `dark:i-${string}`; title?: string; disabled?: boolean }>()
</script>

<template>
  <button
    :aria-label="title"
    role="button"
    :opacity="disabled ? 10 : 70"
    rounded
    :disabled="disabled"
    :hover="disabled ? '' : 'bg-active op100'"
    class="w-1.4em h-1.4em flex"
  >
    <slot>
      <div :class="icon" ma />
    </slot>
  </button>
</template>
