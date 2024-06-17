<script setup type="ts">
defineProps({
  icon: String,
})
</script>

<template>
  <button
    type="button"
    dark="op75"
    bg="gray-200 dark:#111"
    hover="op100"
    rounded-1
    p-0.5
  >
    <span block :class="icon" op65 class="dark:op85 hover:op100" />
  </button>
</template>
