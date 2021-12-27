<script setup lang="ts">
import type { Task } from 'vitest'

defineProps<{ task: Task }>()
</script>

<template>
  <div v-if="task.result?.state === 'pass'" title="Passed" text-green-500 flex-shrink-0 i-carbon:checkmark />
  <div v-else-if="task.result?.state === 'fail'" title="Failed" text-red-500 flex-shrink-0 i-carbon:close />
  <div v-else-if="task.mode === 'todo'" title="Todo" text-gray-500 flex-shrink-0 i-carbon:document-blank />
  <div v-else-if="task.mode === 'skip'" title="Skipped" text-gray-500 flex-shrink-0 i-carbon:redo rotate-90 />
  <div v-else title="Running" text-orange-500 flex-shrink-0 i-carbon:circle-dash animate-spin />
</template>
