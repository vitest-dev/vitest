<script setup lang="ts">
import type { Task } from 'vitest'

const props = defineProps<{
  task: Task
}>()

const duration = computed(() => {
  const { result } = props.task
  return result && result.end ? Math.round(result.end - result.start) : 0
})
</script>

<template>
  <div
    v-if="task"
    flex="~ row"
    items-center
    p="x-2 y-1"
    border-rounded
    cursor-pointer
    hover="bg-active"
  >
    <StatusIcon :task="task" mr-2 flex-shrink-0 text-lg />
    <div flex items-end gap-2>
      <span text-sm truncate font-light>{{ task.name }}</span>
      <span v-if="task.result?.end" text="xs" op20>
        {{ duration }}ms
      </span>
    </div>
  </div>
</template>
