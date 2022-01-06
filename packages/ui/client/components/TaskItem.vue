<script setup lang="ts">
import type { Task } from '#types'

const props = defineProps<{
  task: Task
}>()

const duration = computed(() => {
  const { result } = props.task
  return result && Math.round(result.duration || 0)
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
    <StatusIcon :task="task" mr-2 />
    <div flex items-end gap-2 :text="task?.result?.state === 'fail' ? 'red-500' : ''">
      <span text-sm truncate font-light>{{ task.name }}</span>
      <span v-if="duration" text="xs" op20>
        {{ duration }}ms
      </span>
    </div>
  </div>
</template>
