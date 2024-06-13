<script setup lang="ts">
import type { Task } from 'vitest'
import { nextTick } from 'vue'
import { runFiles, client } from '~/composables/client'
import { caseInsensitiveMatch } from '~/utils/task'
import { openedTreeItems, coverageEnabled } from '~/composables/navigation'
import { hasFailedSnapshot } from '@vitest/ws-client'
import {taskTree, UITaskTreeNode} from '~/composables/explorer/tree'
// import { useSearchTasks } from '~/composables/search'
// import {UISuite, UITest} from '~/composables/explorer/types'
// import { collapseUIEntry, expandUIEntry } from '~/composables/explorer'

// TODO: better handling of "opened" - it means to forcefully open the tree item and set in TasksList right now
const {
  taskId,
  entry,
  search,
  onItemClick,
  onExpanded,
  onCollapsed,
} = defineProps<{
  taskId: string
  entry: UITaskTreeNode
  search?: string
  onItemClick?: (task: Task) => void
  onExpanded?: () => void
  onCollapsed?: () => void
  // onExpanded?: (id: string, height: number, fromChild: boolean) => void
  // onCollapsed?: (id: string, height: number, fromChild: boolean) => void
}>()

console.log(`${entry.id} [${taskId}]: ${entry.expandable}`)

// defineOptions({ inheritAttrs: false })

const task = computed(() => client.state.idMap.get(taskId)!)
// const { filteredTasks } = useSearchTasks(task)

const isOpened = computed(() => {
  const expandable = entry.expandable
  const expanded = entry.expanded
  // openedTreeItems logic will be moved to tree composable
  return expandable && expanded// || openedTreeItems.value.includes(taskId)
})
const hasChildren = computed(() => {
  if (!entry.expandable)
    return false

  if (!entry.expanded)
    return false

  return 'tasks' in entry && entry.tasks.length
})
const failedSnapshot = computed(() => hasFailedSnapshot(task.value))
// const height = computed(() => isOpened.value ? 28 * (filteredTasks.value.length + 1) : 28)

function toggleOpen() {
  if (!entry.expandable)
    return

  console.log(`toggleOpen[${taskId}]`, isOpened.value, entry.expanded)
  taskTree.toggleExpand(taskId)
  // if (entry.expanded) {
  //   collapseUIEntry(entry as UISuite, false)
  // } else {
  //   expandUIEntry(entry.indent, entry as UISuite, false)
  // }
  // recalculateUITreeExplorer()
  /*if (isOpened.value) {
    const tasksIds = filteredTasks.value.map(t => t.id)
    openedTreeItems.value = openedTreeItems.value.filter(id => id !== taskId && !tasksIds.includes(id))
    nextTick(() => {
      onCollapsed?.()
    })
  } else {
    openedTreeItems.value = [...openedTreeItems.value, task.value.id]
    nextTick(() => {
      onExpanded?.()
    })
  }*/
}

/*
function onChildExpanded(id: string) {
  nextTick(() => {
    openedTreeItems.value = openedTreeItems.value.filter(i => i !== id)
    onExpanded?.(taskId, height.value, true)
  })
}

function onChildCollapsed(id: string) {
  nextTick(() => {
    openedTreeItems.value = openedTreeItems.value.filter(i => i !== id)
    onCollapsed?.(taskId, height.value, true)
  })
}
*/

async function onRun() {
  onItemClick?.(client.state.idMap.get(taskId)!)
  if (coverageEnabled.value) {
    disableCoverage.value = true
    await nextTick()
  }
  await runFiles([task.value.file])
}

function updateSnapshot() {
  return client.rpc.updateSnapshot(client.state.idMap.get(taskId)?.file)
}

const styles = computed(() => {
  if (entry.indent === 0)
    return null

  return {
    paddingLeft: entry.indent ? `${entry.indent * 0.75 + (task.value.type === 'suite' ? 0.50 : 1.75)}rem` : '1rem' }
})

/*const containerRef = ref<HTMLDivElement | undefined>()
const bottom = ref<number>(0)

useResizeObserver(containerRef, (entries) => {
  const { height } = entries[0].contentRect
  if (isOpened.value) {
    bottom.value = height
  }
})*/
</script>

<template>
  <div :style="styles">
    <!-- maybe provide a KEEP STRUCTURE mode, do not filter by search keyword  -->
    <!-- v-if = keepStructure ||  (!search || caseInsensitiveMatch(task.name, search)) -->
    <TaskItem
      :task-id="taskId"
      :opened="entry.expandable && entry.expanded"
      :failed-snapshot="failedSnapshot"
      @click="toggleOpen()"
      @run="onRun()"
      @fix-snapshot="updateSnapshot()"
      @preview="onItemClick?.(task)"
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
    </div>-->
  </div>
</template>
