<script setup lang="ts">
import { hasFailedSnapshot } from '@vitest/ws-client'
import type { Task } from 'vitest'

defineProps<{ task: Task }>()
</script>

<template>
  <div
    v-if="task.result?.state === 'pass'"
    text-green-500
    flex-shrink-0
    i-carbon:checkmark
  />
  <div
    v-else-if="hasFailedSnapshot(task)"
    v-tooltip.right="'Contains failed snapshot'"
    text-red-500
    flex-shrink-0
    i-carbon:compare
  />
  <div
    v-else-if="task.result?.state === 'fail'"
    text-red-500
    flex-shrink-0
    i-carbon:close
  />
  <div
    v-else-if="task.mode === 'todo'"
    v-tooltip.right="'Todo'"
    text-gray-500
    flex-shrink-0
    i-carbon:document-blank
  />
  <div
    v-else-if="task.mode === 'skip' || task.result?.state === 'skip'"
    v-tooltip.right="'Skipped'"
    text-gray-500
    flex-shrink-0
    i-carbon:redo
    rotate-90
  />
  <div
    v-else
    text-yellow-500
    flex-shrink-0
    i-carbon:circle-dash
    animate-spin
  />
</template>
