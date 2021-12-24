<script setup lang="ts">
import { tasksCtx } from '~/context'

const file = inject(tasksCtx)
watchEffect(() => {
  console.log(file.value)
})
</script>

<template>
  <div v-if="file" overflow-auto w-72>
    <div
      h-8
      px-4
      flex
      flex-row
      items-center
      bg-gray-200
      dark:bg-dark-300
      gap-4
    >
      <span font-light text-sm flex-1>
        {{ file.name }}
      </span>
      <button i-carbon-play />
    </div>

    <test-suite
      v-for="suite in file.tasks"
      v-bind="suite"
      :key="suite.id"
    />
  </div>
</template>
