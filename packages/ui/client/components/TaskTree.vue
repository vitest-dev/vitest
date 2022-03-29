<script setup lang="ts">
import type { Task } from '#types'
import { caseInsensitiveMatch } from '~/utils/task'

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
  <!-- maybe provide a KEEP STRUCTURE mode, do not filter by search keyword  -->
  <!-- v-if = keepStructure ||  (!search || caseInsensitiveMatch(task.name, search))-->
  <TaskItem
    v-if="!search || caseInsensitiveMatch(task.name, search)"
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
