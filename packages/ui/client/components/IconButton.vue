<script setup lang="ts">
defineProps<{ icon?: `i-${string}` | `dark:i-${string}`; title?: string; disabled?: boolean }>()
</script>

<template>
  <button
    :aria-label="title"
    role="button"
    :opacity="disabled ? 30 : 70"
    rounded
    :hover="disabled ? '' : 'bg-active op100'"
    class="w-1.4em h-1.4em flex"
    :class="{
      'bg-gray-700': disabled
    }"
  >
    <slot>
      <div :class="icon" ma />
    </slot>
  </button>
</template>
