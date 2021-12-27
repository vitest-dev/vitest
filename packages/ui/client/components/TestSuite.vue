<script setup lang="ts">
import type { Task } from 'vitest'

withDefaults(defineProps<{
  task: Task
  indent: number
}>(), { indent: 0 })
</script>

<template>
  <TaskItem :task="task" :style="{ paddingLeft: `${indent * 0.75 + 0.5}rem`}" />
  <div v-if="task.type === 'suite' && task.tasks.length">
    <TestSuite
      v-for="suite in task.tasks"
      :key="suite.id"
      :task="suite"
      :indent="indent + 1"
    />
  </div>
</template>
