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
    data-testid="status-icon-pass"
    text-green-700 dark:text-green-500
    flex-shrink-0
    i-carbon:checkmark
  />
  <div
    v-else-if="failedSnapshot"
    v-tooltip.right="'Contains failed snapshot'"
    data-testid="status-icon-failed-snapshot"
    text-red-700 dark:text-red-500
    flex-shrink-0
    i-carbon:compare
  />
  <div
    v-else-if="state === 'fail'"
    data-testid="status-icon-fail"
    text-red-700 dark:text-red-500
    flex-shrink-0
    i-carbon:close
  />
  <div
    v-else-if="mode === 'todo'"
    v-tooltip.right="'Todo'"
    data-testid="status-icon-todo"
    text-gray-500
    flex-shrink-0
    i-carbon:document-blank
  />
  <div
    v-else-if="mode === 'skip' || state === 'skip'"
    v-tooltip.right="'Skipped'"
    data-testid="status-icon-skip"
    text-gray-500
    flex-shrink-0
    i-carbon:redo
    rotate-90
  />
  <div
    v-else
    data-testid="status-icon-running"
    text-yellow-700 dark:text-yellow-500
    flex-shrink-0
    i-carbon:circle-dash
    animate-spin
  />
</template>
