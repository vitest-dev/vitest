<script setup lang="ts">
import type { Task } from 'vitest'
import { runFiles } from '~/composables/client';
import { caseInsensitiveMatch } from '~/utils/task'
import { openedTreeItems } from '~/composables/navigation';

defineOptions({ inheritAttrs: false })

const { task, indent = 0, nested = false, search, onItemClick } = defineProps<{
  task: Task
  indent?: number
  nested?: boolean
  search?: string
  onItemClick?: (task: Task) => void
}>()

const isOpened = computed(() => openedTreeItems.value.includes(task.id))

const toggleOpen = () => {
  if (isOpened.value) {
    const tasksIds = 'tasks' in task ? task.tasks.map(t => t.id) : []
    openedTreeItems.value = openedTreeItems.value.filter(id => id !== task.id && !tasksIds.includes(id))
  } else {
    openedTreeItems.value = [...openedTreeItems.value, task.id]
  }
}

const onClick = () => {
  toggleOpen()
}

const onRun = async () => {
  onItemClick?.(task)
  await runFiles([task.file])
}
</script>

<template>
  <!-- maybe provide a KEEP STRUCTURE mode, do not filter by search keyword  -->
  <!-- v-if = keepStructure ||  (!search || caseInsensitiveMatch(task.name, search)) -->
  <TaskItem
    v-if="!nested || !search || caseInsensitiveMatch(task.name, search)"
    v-bind="$attrs"
    :task="task"
    :style="{ paddingLeft: indent ? `${indent * 0.75 + (task.type === 'suite' ? 0.75 : 1.75)}rem` : '1rem' }"
    :opened="isOpened"
    @click="onClick()"
    @run="onRun()"
    @preview="onItemClick?.(task)"
  />
  <div v-if="nested && task.type === 'suite' && task.tasks.length" v-show="isOpened">
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
