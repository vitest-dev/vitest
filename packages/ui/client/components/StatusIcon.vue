<script setup lang="ts">
import type { Task } from 'vitest'

defineProps<{ task: Task }>()
</script>

<template>
  <div v-if="task.result?.state === 'pass'" title="Passed" text-green-500 i-carbon:checkmark />
  <div v-else-if="task.result?.state === 'fail'" title="Failed" text-red-500 i-carbon:close />
  <div v-else-if="task.mode === 'todo'" title="Todo" text-gray-500 i-carbon:document-blank />
  <div v-else-if="task.mode === 'skip'" title="Skipped" text-gray-500 i-carbon:redo rotate-90 />
</template>
