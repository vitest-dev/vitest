<script setup lang="ts">
import type { Task, TaskState } from '@vitest/runner'
import type { TaskTreeNodeType } from '~/composables/explorer/types'
import { hasFailedSnapshot } from '@vitest/ws-client'
import { Tooltip as VueTooltip } from 'floating-vue'
import { nextTick } from 'vue'
import { client, isReport, runFiles, runTask } from '~/composables/client'
import { showSource } from '~/composables/codemirror'
import { explorerTree } from '~/composables/explorer'
import { escapeHtml, highlightRegex } from '~/composables/explorer/state'
import { coverageEnabled } from '~/composables/navigation'

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
  disableTaskLocation,
  onItemClick,
  projectNameColor,
  state,
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
  disableTaskLocation?: boolean
  onItemClick?: (task: Task) => void
}>()

const task = computed(() => client.state.idMap.get(taskId))

const failedSnapshot = computed(() => {
  // don't traverse the tree if it's a report
  if (isReport) {
    return false
  }

  const t = task.value
  return t && hasFailedSnapshot(t)
})

function toggleOpen() {
  if (!expandable) {
    onItemClick?.(task.value!)
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

  if (type === 'file') {
    await runFiles([task.file])
  }
  else {
    await runTask(task)
  }
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
  // action buttons
  gridColumns.push('min-content')

  // all the vertical lines with width 1rem and mx-2: always centered
  return `grid-template-columns: ${
    entries.map(() => '1rem').join(' ')
  } ${gridColumns.join(' ')};`
})

const runButtonTitle = computed(() => {
  return type === 'file'
    ? 'Run current file'
    : type === 'suite'
      ? 'Run all tests in this suite'
      : 'Run current test'
})

const escapedName = computed(() => escapeHtml(name))
const highlighted = computed(() => {
  const regex = highlightRegex.value
  const useName = escapedName.value
  return regex
    ? useName.replace(regex, match => `<span class="highlight">${match}</span>`)
    : useName
})

const disableShowDetails = computed(() => type !== 'file' && disableTaskLocation)
const showDetailsTooltip = computed(() => {
  return type === 'file'
    ? 'Open test details'
    : type === 'suite'
      ? 'View Suite Source Code'
      : 'View Test Source Code'
})
const showDetailsClasses = computed(() => disableShowDetails.value ? 'color-red5 dark:color-#f43f5e' : null)

function showDetails() {
  const t = task.value!
  if (type === 'file') {
    onItemClick?.(t)
  }
  else {
    showSource(t)
  }
}

const projectNameTextColor = computed(() => {
  switch (projectNameColor) {
    case 'blue':
    case 'green':
    case 'magenta':
      return 'white'
    default:
      return 'black'
  }
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
    <div flex items-end gap-2 overflow-hidden>
      <div v-if="type === 'file' && typecheck" v-tooltip.bottom="'This is a typecheck test. It won\'t report results of the runtime tests'" class="i-logos:typescript-icon" flex-shrink-0 />
      <span text-sm truncate font-light>
        <span v-if="type === 'file' && projectName" class="rounded-full py-0.5 px-1 mr-1 text-xs" :style="{ backgroundColor: projectNameColor, color: projectNameTextColor }">
          {{ projectName }}
        </span>
        <span :text="state === 'fail' ? 'red-500' : ''" v-html="highlighted" />
      </span>
      <span v-if="typeof duration === 'number'" text="xs" op20 style="white-space: nowrap">
        {{ duration > 0 ? duration : '< 1' }}ms
      </span>
    </div>
    <div gap-1 justify-end flex-grow-1 pl-1 class="test-actions">
      <IconAction
        v-if="!isReport && failedSnapshot"
        v-tooltip.bottom="'Fix failed snapshot(s)'"
        data-testid="btn-fix-snapshot"
        title="Fix failed snapshot(s)"
        icon="i-carbon:result-old"
        @click.prevent.stop="updateSnapshot(task)"
      />
      <VueTooltip
        placement="bottom"
        class="w-1.4em h-1.4em op100 rounded flex"
        :class="showDetailsClasses"
      >
        <IconButton
          data-testid="btn-open-details"
          icon="i-carbon:intrusion-prevention"
          @click.prevent.stop="showDetails"
        />
        <template #popper>
          <div v-if="disableShowDetails" class="op100 gap-1 p-y-1" grid="~ items-center cols-[1.5em_1fr]">
            <div class="i-carbon:information-square w-1.5em h-1.5em" />
            <div>{{ showDetailsTooltip }}: this feature is not available, you have disabled <span class="text-[#add467]">includeTaskLocation</span> in your configuration file.</div>
            <div style="grid-column: 2">
              Clicking this button the code tab will position the cursor at first line in the source code since the UI doesn't have the information available.
            </div>
          </div>
          <div v-else>
            {{ showDetailsTooltip }}
          </div>
        </template>
      </VueTooltip>
      <IconButton
        v-if="!isReport"
        v-tooltip.bottom="runButtonTitle"
        data-testid="btn-run-test"
        :title="runButtonTitle"
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
.item-wrapper:hover .test-actions {
  display: flex;
}
</style>
