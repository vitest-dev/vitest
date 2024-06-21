<script setup lang="ts">
import type { RunMode, TaskState } from 'vitest'

defineProps<{
  state?: TaskState
  mode?: RunMode
  failedSnapshot?: boolean
}>()
</script>

<template>
  <div
    v-if="state === 'pass'"
    text-green-500
    flex-shrink-0
    i-carbon:checkmark
  />
  <div
    v-else-if="failedSnapshot"
    v-tooltip.right="'Contains failed snapshot'"
    text-red-500
    flex-shrink-0
    i-carbon:compare
  />
  <div
    v-else-if="state === 'fail'"
    text-red-500
    flex-shrink-0
    i-carbon:close
  />
  <div
    v-else-if="mode === 'todo'"
    v-tooltip.right="'Todo'"
    text-gray-500
    flex-shrink-0
    i-carbon:document-blank
  />
  <div
    v-else-if="mode === 'skip' || state === 'skip'"
    v-tooltip.right="'Skipped'"
    text-gray-500
    flex-shrink-0
    i-carbon:redo
    rotate-90
  />
  <div v-else text-yellow-500 flex-shrink-0 i-carbon:circle-dash animate-spin />
</template>
