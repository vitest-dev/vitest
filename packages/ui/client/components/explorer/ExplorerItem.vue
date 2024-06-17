<script setup lang="ts">
import type { Task, TaskState } from '@vitest/runner'
import { nextTick } from 'vue'
import { client, runFiles } from '~/composables/client'
import { coverageEnabled } from '~/composables/navigation'
import type { TaskTreeNodeType } from '~/composables/explorer/types'
import { explorerTree } from '~/composables/explorer'

// TODO: better handling of "opened" - it means to forcefully open the tree item and set in TasksList right now
const {
  taskId,
  indent,
  duration,
  current,
  opened,
  expandable,
  type,
  onItemClick,
} = defineProps<{
  taskId: string
  name: string
  indent: number
  typecheck?: boolean
  duration?: number
  state?: TaskState
  current: boolean
  type: TaskTreeNodeType
  opened: boolean
  expandable: boolean
  search?: string
  projectName?: string
  projectNameColor: string
  onItemClick?: (task: Task) => void
}>()

function toggleOpen() {
  if (!expandable) {
    return
  }

  if (opened) {
    explorerTree.collapseNode(taskId)
  }
  else {
    explorerTree.expandNode(taskId)
  }
}

async function onRun(task: Task) {
  onItemClick?.(task)
  if (coverageEnabled.value) {
    disableCoverage.value = true
    await nextTick()
  }
  await runFiles([task.file])
}

function updateSnapshot(task: Task) {
  return client.rpc.updateSnapshot(task.file)
}

const styles = computed(() => {
  if (indent === 0) {
    return null
  }

  return {
    paddingLeft: indent ? `${indent * 0.75 + (type === 'suite' ? 0.50 : 1.75)}rem` : '1rem',
  }
})

/* const containerRef = ref<HTMLDivElement | undefined>()
const bottom = ref<number>(0)

useResizeObserver(containerRef, (entries) => {
  const { height } = entries[0].contentRect
  if (isOpened.value) {
    bottom.value = height
  }
}) */
</script>

<template>
  <div :style="styles">
    <!-- maybe provide a KEEP STRUCTURE mode, do not filter by search keyword  -->
    <!-- v-if = keepStructure ||  (!search || caseInsensitiveMatch(task.name, search)) -->
    <TaskItem
      :task-id="taskId"
      :opened="opened"
      :state="state"
      :duration="duration"
      :type="type"
      :name="name"
      :typecheck="typecheck"
      :project-name="projectName"
      :project-name-color="projectNameColor"
      :current="current"
      @click="toggleOpen()"
      @run="task => onRun(task)"
      @fix-snapshot="task => updateSnapshot(task)"
      @preview="task => onItemClick?.(task)"
    />
    <!--    <div
      v-if="nested && task.type === 'suite' && task.tasks.length"
      v-show="isOpened"
      flex
      relative
    >
      <div
        v-if="isOpened"
        flex mt&#45;&#45;3px ml-15px justify-center
      >
        <div w-1px border="x base" mb-9></div>
      </div>
    </div> -->
  </div>
</template>
