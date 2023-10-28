<script setup lang="ts">
import type { Task } from 'vitest'
import { caseInsensitiveMatch } from '~/utils/task'
import { isDescribeBlock, selectedTest, testIndex, viewMode } from '~/composables/params'

defineOptions({ inheritAttrs: false })

const { task, indent = 0, index, nested = false, nestedIndex, search, onItemClick } = defineProps<{
  task: Task
  index: number
  nestedIndex?: number
  indent?: number
  nested?: boolean
  search?: string
  onItemClick?: (task: Task) => void
}>()

function handleItemClick(task: Task, index: number, nestedIndex?: number) {
  testIndex.value = `${index}|${nestedIndex}`
  if (task.type === 'suite')
    isDescribeBlock.value = '1'
  else if (task.type === 'test')
    isDescribeBlock.value = '0'

  let taskName = task.name
  if (taskName.includes('(') || taskName.includes(')')) {
    taskName = taskName.replaceAll('(', '\\(')
    taskName = taskName.replaceAll(')', '\\)')
  }
  selectedTest.value = taskName
  if (viewMode.value !== 'editor')
    viewMode.value = 'editor'
}
</script>

<template>
  <!-- maybe provide a KEEP STRUCTURE mode, do not filter by search keyword  -->
  <!-- v-if = keepStructure ||  (!search || caseInsensitiveMatch(task.name, search)) -->
  <TaskItem
    v-if="!search || caseInsensitiveMatch(task.name, search)"
    v-bind="$attrs"
    :task="task"
    :index="index"
    :nested-index="nestedIndex"
    :style="{ paddingLeft: `${indent * 0.75 + 1}rem` }"
    @click="onItemClick ? onItemClick(task) : handleItemClick(task, index, nestedIndex)"
  />
  <div v-if="nested && task.type === 'suite' && task.tasks.length">
    <TaskTree
      v-for="(suite, nestedIndexForSuite) in task.tasks"
      :key="suite.id"
      :task="suite"
      :index="index"
      :nested-index="nestedIndexForSuite"
      :nested="nested"
      :indent="indent + 1"
      :search="search"
      :on-item-click="onItemClick"
    />
  </div>
</template>
