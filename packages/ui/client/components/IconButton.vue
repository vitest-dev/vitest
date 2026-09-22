<script setup lang="ts">
defineProps<{
  icon?: `i-${string}` | `dark:i-${string}`
  title?: string
  disabled?: boolean
  active?: boolean
}>()
</script>

<template>
  <button
    :aria-label="title"
    role="button"
    :disabled="disabled"
    class="w-1.4em h-1.4em flex rounded"
    :class="{
      'op10': disabled,
      'op70': !disabled,
      'bg-gray-500:35': active,
      'hover:bg-active hover:op100': !disabled && !active,
    }"
  >
    <slot>
      <span :class="icon" class="ma block" />
    </slot>
  </button>
</template>
