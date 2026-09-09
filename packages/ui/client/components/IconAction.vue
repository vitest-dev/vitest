<script setup lang="ts">
defineProps<{
  icon?: string
}>()
</script>

<template>
  <button
    type="button"
    class="dark:op75 bg-gray-200 dark:bg-#111 hover:op100 rounded-1 p-0.5"
  >
    <span :class="icon" class="dark:op85 hover:op100 block op65" />
  </button>
</template>
