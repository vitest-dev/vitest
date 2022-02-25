<script setup lang="ts">
import type { Task } from '#types'

withDefaults(defineProps<{
  task: Task
  indent?: number
  nested?: boolean
  search?: string
  onItemClick?: (task: Task) => void
}>(), {
  indent: 0,
  nested: false,
})
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <TaskItem
    v-if="!search || task.name.includes(search)"
    v-bind="$attrs"
    :task="task"
    :style="{ paddingLeft: `${indent * 0.75 + 1}rem`}"
    @click="onItemClick && onItemClick(task)"
  />
  <div v-if="nested && task.type === 'suite' && task.tasks.length">
    <TaskTree
      v-for="suite in task.tasks"
      :key="suite.id"
      :task="suite"
      :nested="nested"
      :indent="indent + 1"
      :search="search"
      :on-item-click="onItemClick"
    />
  </div>
</template>
