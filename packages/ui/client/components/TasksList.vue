<script setup lang="ts">
import type { ComputedRef } from 'vue'
import type { File, Task } from 'vitest'
import { findById, testRunState } from '~/composables/client'
import { activeFileId } from '~/composables/params'
import { caseInsensitiveMatch, isSuite } from '~/utils/task'

defineOptions({ inheritAttrs: false })

// eslint-disable-next-line unused-imports/no-unused-vars
const { tasks, indent = 0, nested = false, groupByType = false, onItemClick } = defineProps<{
  tasks: Task[]
  indent?: number
  nested?: boolean
  groupByType?: boolean
  onItemClick?: (task: Task) => void
}>()

const emit = defineEmits<{
  (event: 'run', files?: File[]): void
}>()

const search = ref<string>('')
const searchBox = ref<HTMLInputElement | undefined>()
const isFiltered = computed(() => search.value.trim() !== '')

const filtered = computed(() => {
  if (!search.value.trim())
    return tasks

  return tasks.filter(task => matchTasks([task], search.value))
})
const filteredTests: ComputedRef<File[]> = computed(() => isFiltered.value ? filtered.value.map(task => findById(task.id)!).filter(Boolean) : [])

const failed = computed(() => filtered.value.filter(task => task.result?.state === 'fail'))
const success = computed(() => filtered.value.filter(task => task.result?.state === 'pass'))
const skipped = computed(() => filtered.value.filter(task => task.mode === 'skip' || task.mode === 'todo'))
const running = computed(() => filtered.value.filter(task =>
  !failed.value.includes(task)
  && !success.value.includes(task)
  && !skipped.value.includes(task),
))

const disableClearSearch = computed(() => search.value === '')

const throttledRunning = useThrottle(running, 250)

function clearSearch(focus: boolean) {
  search.value = ''
  focus && searchBox.value?.focus()
}

function matchTasks(tasks: Task[], search: string): boolean {
  let result = false

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    if (caseInsensitiveMatch(task.name, search)) {
      result = true
      break
    }

    // walk whole task tree
    if (isSuite(task) && task.tasks) {
      result = matchTasks(task.tasks, search)
      if (result)
        break
    }
  }

  return result
}
</script>

<template>
  <div h="full" flex="~ col">
    <div>
      <div p="2" h-10 flex="~ gap-2" items-center bg-header border="b base">
        <slot name="header" :filtered-tests="isFiltered ? filteredTests : undefined" />
      </div>
      <div
        p="l3 y2 r2"
        flex="~ gap-2"
        items-center
        bg-header
        border="b-2 base"
      >
        <div class="i-carbon:search" flex-shrink-0 />
        <input
          ref="searchBox"
          v-model="search"
          placeholder="Search..."
          outline="none"
          bg="transparent"
          font="light"
          text="sm"
          flex-1
          pl-1
          :op="search.length ? '100' : '50'"
          @keydown.esc="clearSearch(false)"
          @keydown.enter="emit('run', isFiltered ? filteredTests : undefined)"
        >
        <IconButton
          v-tooltip.bottom="'Clear search'"
          :disabled="disableClearSearch"
          title="Clear search"
          icon="i-carbon:filter-remove"
          @click.passive="clearSearch(true)"
        />
      </div>
    </div>

    <div class="scrolls" flex-auto py-1>
      <template v-if="groupByType">
        <DetailsPanel v-if="failed.length">
          <template #summary>
            <div text-red5>
              FAIL ({{ failed.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in failed"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
        <DetailsPanel v-if="running.length || testRunState === 'running'">
          <template #summary>
            <div text-yellow5>
              RUNNING ({{ throttledRunning.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in throttledRunning"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
        <DetailsPanel v-if="success.length">
          <template #summary>
            <div text-green5>
              PASS ({{ success.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in success"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
        <DetailsPanel v-if="skipped.length">
          <template #summary>
            <div class="text-purple5:50">
              SKIP ({{ skipped.length }})
            </div>
          </template>
          <TaskTree
            v-for="task in skipped"
            :key="task.id"
            :task="task"
            :nested="nested"
            :search="search"
            :class="activeFileId === task.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </DetailsPanel>
      </template>

      <!-- flat -->
      <template v-else>
        <TaskTree
          v-for="task in filtered"
          :key="task.id"
          :task="task"
          :nested="nested"
          :search="search"
          :class="activeFileId === task.id ? 'bg-active' : ''"
          :on-item-click="onItemClick"
        />
      </template>
      <!-- empty-state -->
      <template v-if="isFiltered && filtered.length === 0">
        <div flex="~ col" items-center p="x4 y4" font-light>
          <div op30>
            No matched test
          </div>
          <button
            font-light
            op="50 hover:100"
            text-sm
            border="~ gray-400/50 rounded"
            p="x2 y0.5"
            m="t2"
            @click.passive="clearSearch(true)"
          >
            Clear
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
