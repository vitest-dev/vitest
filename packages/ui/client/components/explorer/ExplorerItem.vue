<script setup lang="ts">
import type { Task, TaskState } from '@vitest/runner'
import { nextTick } from 'vue'
import { hasFailedSnapshot } from '@vitest/ws-client'
import { client, isReport, runFiles } from '~/composables/client'
import { coverageEnabled } from '~/composables/navigation'
import type { TaskTreeNodeType } from '~/composables/explorer/types'
import { explorerTree } from '~/composables/explorer'
import { search } from '~/composables/explorer/state'

// TODO: better handling of "opened" - it means to forcefully open the tree item and set in TasksList right now
const {
  taskId,
  indent,
  name,
  duration,
  current,
  opened,
  expandable,
  typecheck,
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

const task = computed(() => client.state.idMap.get(taskId))

const failedSnapshot = computed(() => task.value && hasFailedSnapshot(task.value))

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

const data = computed(() => {
  return indent <= 0 ? [] : Array.from({ length: indent }, (_, i) => `${taskId}-${i}`)
})
const gridStyles = computed(() => {
  const entries = data.value
  const gridColumns: string[] = []
  // folder icon
  if (type === 'file' || type === 'suite') {
    gridColumns.push('min-content')
  }

  // status icon
  gridColumns.push('min-content')
  // typecheck icon
  if (type === 'suite' && typecheck) {
    gridColumns.push('min-content')
  }
  // text content
  gridColumns.push('minmax(0, 1fr)')
  // buttons
  if (type === 'file') {
    gridColumns.push('min-content')
  }
  // all the vertical lines with width 1rem and mx-2: always centered
  return `grid-template-columns: ${
    entries.map(() => '1rem').join(' ')
  } ${gridColumns.join(' ')};`
})

const highlightRegex = computed(() => {
  const searchString = search.value.toLowerCase()
  return searchString.length ? new RegExp(`(${searchString})`, 'gi') : null
})

const highlighted = computed(() => {
  const regex = highlightRegex.value
  return regex
    ? name.replace(regex, match => `<span class="highlight">${match}</span>`)
    : name
})
</script>

<template>
  <div
    v-if="task"
    items-center
    p="x-2 y-1"
    grid="~ rows-1 items-center gap-x-2"
    w-full
    h-28px
    border-rounded
    hover="bg-active"
    cursor-pointer
    class="item-wrapper"
    :style="gridStyles"
    :aria-label="name"
    :data-current="current"
    @click="toggleOpen()"
  >
    <template v-if="indent > 0">
      <div v-for="i in data" :key="i" border="solid gray-500 dark:gray-400" class="vertical-line" h-28px inline-flex mx-2 op20 />
    </template>
    <div v-if="type === 'file' || type === 'suite'" w-4>
      <div :class="opened ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right op20'" op20 />
    </div>
    <StatusIcon :state="state" :mode="task.mode" :failed-snapshot="failedSnapshot" w-4 />
    <div v-if="type === 'suite' && typecheck" class="i-logos:typescript-icon" flex-shrink-0 mr-2 />
    <div flex items-end gap-2 :text="state === 'fail' ? 'red-500' : ''" overflow-hidden>
      <span text-sm truncate font-light>
        <!-- only show [] in files view -->
        <span v-if="type === 'file' && projectName" :style="{ color: projectNameColor }">
          [{{ projectName }}]
        </span>
        <span v-html="highlighted" />
      </span>
      <span v-if="typeof duration === 'number'" text="xs" op20 style="white-space: nowrap">
        {{ duration > 0 ? duration : '< 1' }}ms
      </span>
    </div>
    <div v-if="type === 'file'" gap-1 justify-end flex-grow-1 pl-1 class="test-actions">
      <IconAction
        v-if="!isReport && failedSnapshot"
        v-tooltip.bottom="'Fix failed snapshot(s)'"
        data-testid="btn-fix-snapshot"
        title="Fix failed snapshot(s)"
        icon="i-carbon-result-old"
        @click.prevent.stop="updateSnapshot(task)"
      />
      <IconAction
        v-tooltip.bottom="'Open test details'"
        data-testid="btn-open-details"
        title="Open test details"
        icon="i-carbon-intrusion-prevention"
        @click.prevent.stop="onItemClick?.(task)"
      />
      <IconAction
        v-if="!isReport"
        v-tooltip.bottom="'Run current test'"
        data-testid="btn-run-test"
        title="Run current test"
        icon="i-carbon:play-filled-alt"
        text-green5
        @click.prevent.stop="onRun(task)"
      />
    </div>
  </div>
</template>

<style scoped>
.vertical-line:first-of-type {
  @apply border-l-2px;
}
.vertical-line + .vertical-line {
  @apply border-r-1px;
}
.test-actions {
  display: none;
}
.item-wrapper:hover .test-actions,
.item-wrapper[data-current="true"] .test-actions {
  display: flex;
}
</style>
