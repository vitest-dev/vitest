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
    flex
    flex-row
    items-center
    px-4
    h-12
    border-rounded
    cursor-pointer
    hover="bg-gray-200 dark:bg-dark-300"
  >
    <span
      v-if="task.result?.state === 'pass'"
      text-green-500
      i-carbon:checkmark-outline
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <span
      v-else-if="task.result?.state === 'fail'"
      text-red-500
      i-carbon:misuse-outline
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <span
      v-else-if="task.mode === 'todo'"
      text-yellow-500
      i-carbon:help
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <span
      v-else-if="task.mode === 'skip'"
      text-blue-500
      i-carbon:information
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <div flex flex-col>
      <span text-sm truncate>{{ task.name }}</span>
      <span v-if="task.result?.end" text="xs gray-500 dark:light-500" op50>
        {{ duration }}ms
      </span>
    </div>
  </div>
  <div v-if="task.type === 'suite' && task.tasks.length" pl-4>
    <test-suite
      v-for="suite in task.tasks"
      :key="suite.id"
      :task="suite"
    />
  </div>
</template>
