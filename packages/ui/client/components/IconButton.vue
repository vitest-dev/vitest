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
    :opacity="disabled ? 10 : 70"
    rounded
    :disabled="disabled"
    :hover="disabled || active ? '' : 'bg-active op100'"
    class="w-1.4em h-1.4em flex" :class="[{ 'bg-gray-500:35 op100': active }]"
  >
    <slot>
      <span :class="icon" ma block />
    </slot>
  </button>
</template>
