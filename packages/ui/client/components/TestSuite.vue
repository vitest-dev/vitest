<script setup lang="ts">
type TaskUI = {
  id: string
  type: string
  name: string
  mode: string
  state?: string
  duration?: number
  tasks?: TaskUI[]
}
defineProps<TaskUI>()
</script>

<template>
  <div
    v-if="name"

    flex
    flex-row
    items-center
    px-4
    h-12
    border-rounded
    cursor-pointer
    hover:bg-gray-200
    dark:hover:bg-dark-300
  >
    <span
      v-if="state === 'pass'"
      text-green-500
      i-carbon:checkmark-outline
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <span
      v-else-if="state === 'fail'"
      text-red-500
      i-carbon:misuse-outline
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <span
      v-else-if="mode === 'todo'"
      text-yellow-500
      i-carbon:help
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <span
      v-else-if="mode === 'skip'"
      text-blue-500
      i-carbon:information
      flex-shrink-0
      mr-4
      block
      text-xl
    />
    <div flex flex-col>
      <span text-sm truncate>{{ name }}</span>
      <span
        text-xs
        text-gray-500
        dark:text-light-500
        text-opacity-50
        dark:text-opacity-50
      >
        Took {{ duration }}ms
      </span>
    </div>
  </div>
  <div v-if="tasks" pl-4>
    <test-suite
      v-for="suite in tasks"
      v-bind="suite"
      :key="suite.id"
    />
  </div>
</template>
