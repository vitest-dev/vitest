<script setup lang="ts">
import type { Task } from 'vitest'
import { nextTick } from 'vue'
import { runFiles, client } from '~/composables/client'
import { caseInsensitiveMatch } from '~/utils/task'
import { openedTreeItems, coverageEnabled } from '~/composables/navigation'
import { hasFailedSnapshot } from '@vitest/ws-client'

defineOptions({ inheritAttrs: false })

// TODO: better handling of "opened" - it means to forcefully open the tree item and set in TasksList right now
const { taskId, indent = 0, nested = false, search, onItemClick, opened = false } = defineProps<{
  taskId: string
  indent?: number
  opened?: boolean
  nested?: boolean
  search?: string
  onItemClick?: (task: Task) => void
}>()

const task = computed(() => client.state.idMap.get(taskId)!)
const isOpened = computed(() => opened || openedTreeItems.value.includes(taskId))
const failedSnapshot = computed(() => hasFailedSnapshot(task.value))

function toggleOpen() {
  if (isOpened.value) {
    const currentTask = client.state.idMap.get(taskId)!
    const tasksIds = 'tasks' in currentTask ? currentTask.tasks.map(t => t.id) : []
    openedTreeItems.value = openedTreeItems.value.filter(id => id !== taskId && !tasksIds.includes(id))
  } else {
    openedTreeItems.value = [...openedTreeItems.value, task.value.id]
  }
}

async function onRun() {
  onItemClick?.(task.value)
  if (coverageEnabled.value) {
    disableCoverage.value = true
    await nextTick()
  }
  await runFiles([task.value.file])
}

function updateSnapshot() {
  return client.rpc.updateSnapshot(task.value)
}
</script>

<template>
  <!-- maybe provide a KEEP STRUCTURE mode, do not filter by search keyword  -->
  <!-- v-if = keepStructure ||  (!search || caseInsensitiveMatch(task.name, search)) -->
  <TaskItem
    v-if="opened || !nested || !search || caseInsensitiveMatch(task.name, search)"
    v-bind="$attrs"
    :task-id="task.id"
    :style="{ paddingLeft: indent ? `${indent * 0.75 + (task.type === 'suite' ? 0.50 : 1.75)}rem` : '1rem' }"
    :opened="isOpened && task.type === 'suite' && task.tasks.length"
    :failed-snapshot="failedSnapshot"
    @click="toggleOpen()"
    @run="onRun()"
    @fix-snapshot="updateSnapshot()"
    @preview="onItemClick?.(task)"
  />
  <div v-if="nested && task.type === 'suite' && task.tasks.length" v-show="isOpened">
    <TaskTree
      v-for="suite in task.tasks"
      :key="suite.id"
      :failed-snapshot="false"
      :task-id="suite.id"
      :nested="nested"
      :indent="indent + 1"
      :search="search"
      :on-item-click="onItemClick"
    />
  </div>
</template>
