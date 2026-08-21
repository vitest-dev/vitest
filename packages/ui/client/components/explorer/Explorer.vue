<script setup lang="ts">
import type { RunnerTestFile as File, RunnerTask as Task } from 'vitest'
import type { UITaskTreeNode } from '~/composables/explorer/types'
import { hideAllPoppers } from 'floating-vue'
import { computed, nextTick, ref } from 'vue'

import { RecycleScroller } from 'vue-virtual-scroller'
import { availableProjects, client, config } from '~/composables/client'
import { explorerTree } from '~/composables/explorer'
import { useSearch } from '~/composables/explorer/search'
import { ALL_PROJECTS, projectSort } from '~/composables/explorer/state'
import { activeFileId, selectedTest } from '~/composables/params'
import FilterStatus from '../FilterStatus.vue'
import IconButton from '../IconButton.vue'
import ResultsPanel from '../ResultsPanel.vue'
import ExplorerItem from './ExplorerItem.vue'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

defineOptions({ inheritAttrs: false })

const { onItemClick } = defineProps<{
  onItemClick?: (task: Task) => void
}>()

const emit = defineEmits<{
  (event: 'item-click', files?: File[]): void
  (event: 'run', files?: File[]): void
}>()

const includeTaskLocation = computed(() => config.value.includeTaskLocation)
const slowTime = computed(() => {
  const threshold = config.value.slowTestThreshold
  if (typeof threshold === 'number') {
    return ` (>${threshold}ms)`
  }

  return ''
})

const searchBox = ref<HTMLInputElement | undefined>()
const selectProjectRef = ref<HTMLSelectElement | undefined>()
const sortProjectRef = ref<HTMLSelectElement | undefined>()
const scrollerRef = ref<{
  el?: HTMLElement
  scrollToItem: (index: number, options?: { align?: 'nearest' }) => void
}>()
const focusedTaskId = ref<string>()
const ariaActiveTaskId = ref<string>()
const selectedTaskId = ref<string>()

const {
  initialized,
  filter,
  search,
  disableFilter,
  isFiltered,
  isFilteredByStatus,
  disableClearSearch,
  clearAll,
  clearSearch,
  clearFilter,
  filteredFiles,
  testsTotal,
  uiEntries,
  enableProjects,
  disableClearProjects,
  currentProject,
  currentProjectName,
  clearProject,
  clearProjectSort,
  disableClearProjectSort,
  searchMatcher,
} = useSearch(searchBox, selectProjectRef, sortProjectRef)

const activeTaskId = computed(() => {
  if (uiEntries.value.some(item => item.id === focusedTaskId.value)) {
    return focusedTaskId.value
  }
  if (selectedTest.value && uiEntries.value.some(item => item.id === selectedTest.value)) {
    return selectedTest.value
  }
  if (uiEntries.value.some(item => item.id === activeFileId.value)) {
    return activeFileId.value
  }
  return uiEntries.value[0]?.id
})

const treeItemAria = computed(() => {
  const siblings = new Map<string, UITaskTreeNode[]>()
  for (const item of uiEntries.value) {
    const entries = siblings.get(item.parentId) ?? []
    entries.push(item)
    siblings.set(item.parentId, entries)
  }

  const metadata = new Map<string, { posinset: number; setsize: number }>()
  for (const entries of siblings.values()) {
    for (let i = 0; i < entries.length; i++) {
      metadata.set(entries[i].id, { posinset: i + 1, setsize: entries.length })
    }
  }
  return metadata
})

function isSelected(taskId: string) {
  const selectedId = selectedTaskId.value ?? selectedTest.value ?? activeFileId.value
  return selectedId === taskId
}

function getTreeItemElement(taskId: string) {
  return document.getElementById(`explorer-item-${taskId}`)
}

async function updateAriaActiveTask(taskId: string, index: number) {
  if (!getTreeItemElement(taskId)) {
    scrollerRef.value?.scrollToItem(index, { align: 'nearest' })
    for (let i = 0; i < 3 && !getTreeItemElement(taskId); i++) {
      await nextTick()
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
  }
  if (focusedTaskId.value === taskId && getTreeItemElement(taskId)) {
    ariaActiveTaskId.value = taskId
  }
}

function selectItem(index: number) {
  const item = uiEntries.value[index]
  const task = item && client.state.idMap.get(item.id)
  if (!item || !task) {
    return
  }

  focusedTaskId.value = item.id
  selectedTaskId.value = item.id
  onItemClick?.(task)
  void updateAriaActiveTask(item.id, index)
}

function onTreeKeydown(event: KeyboardEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'tree') {
    return
  }

  const index = uiEntries.value.findIndex(item => item.id === activeTaskId.value)
  const item = uiEntries.value[index]
  if (!item) {
    return
  }

  let nextIndex: number | undefined
  if (event.key === 'ArrowUp') {
    nextIndex = Math.max(index - 1, 0)
  }
  else if (event.key === 'ArrowDown') {
    nextIndex = Math.min(index + 1, uiEntries.value.length - 1)
  }
  else if (event.key === 'Home') {
    nextIndex = 0
  }
  else if (event.key === 'End') {
    nextIndex = uiEntries.value.length - 1
  }
  else if (event.key === 'ArrowRight') {
    if (item.expandable && !item.expanded) {
      explorerTree.expandNode(item.id)
    }
    else if (uiEntries.value[index + 1]?.indent > item.indent) {
      nextIndex = index + 1
    }
  }
  else if (event.key === 'ArrowLeft') {
    if (item.expandable && item.expanded) {
      explorerTree.collapseNode(item.id)
    }
    else {
      nextIndex = uiEntries.value.findIndex(entry => entry.id === item.parentId)
    }
  }
  else if (event.key === 'Enter') {
    const task = client.state.idMap.get(item.id)
    if (task) {
      selectedTaskId.value = item.id
      onItemClick?.(task)
    }
  }
  else if (event.key !== ' ') {
    return
  }

  event.preventDefault()
  if (nextIndex !== undefined && nextIndex >= 0 && nextIndex !== index) {
    selectItem(nextIndex)
  }
}

function onTreeFocus(event: FocusEvent) {
  if (event.target === event.currentTarget && !focusedTaskId.value) {
    focusedTaskId.value = activeTaskId.value
    const index = uiEntries.value.findIndex(item => item.id === focusedTaskId.value)
    if (focusedTaskId.value && index >= 0) {
      void updateAriaActiveTask(focusedTaskId.value, index)
    }
  }
}

function onTreeBlur(event: FocusEvent) {
  if (event.target === event.currentTarget) {
    focusedTaskId.value = undefined
    ariaActiveTaskId.value = undefined
    selectedTaskId.value = undefined
  }
}

function onTreeItemClick(taskId: string) {
  focusedTaskId.value = taskId
  ariaActiveTaskId.value = taskId
  selectedTaskId.value = taskId
  scrollerRef.value?.el?.focus()
}
</script>

<template>
  <div h="full" flex="~ col">
    <div>
      <div p="2" h-10 flex="~ gap-2" items-center bg-header border="b base">
        <slot name="header" :filtered-files="isFiltered || isFilteredByStatus ? filteredFiles : undefined" />
      </div>
      <div
        v-if="enableProjects"
        p="l3 y2 r2"
        bg-header
        border="b-2 base"
        grid="~ cols-[auto_auto_minmax(0,1fr)_auto] gap-x-2 gap-y-1"
        items-center
      >
        <div class="i-carbon:workspace" flex-shrink-0 />
        <label for="project-select" text-sm>
          Projects
        </label>
        <div class="relative flex-1">
          <select
            id="project-select"
            ref="selectProjectRef"
            v-model="currentProject"
            w-full
            appearance-none
            bg-base
            text-base
            border="~ base rounded"
            pl-2
            pr-8
            py-1
            text-sm
            cursor-pointer
            hover:bg-active
            class="outline-none"
          >
            <option :value="ALL_PROJECTS" class="text-base bg-base">
              All Projects
            </option>
            <option
              v-for="project in availableProjects"
              :key="project"
              :value="project"
              class="text-base bg-base"
            >
              {{ project }}
            </option>
          </select>
          <div class="i-carbon:chevron-down absolute right-2 top-1/2 op50 -translate-y-1/2 pointer-events-none" />
        </div>

        <IconButton
          v-tooltip.bottom="'Clear project filter'"
          :disabled="disableClearProjects"
          title="Clear project filter"
          icon="i-carbon:filter-remove"
          @click.passive="clearProject(true)"
        />
      </div>
      <div
        p="l3 y2 r2"
        bg-header
        border="b-2 base"
        grid="~ cols-[auto_auto_minmax(0,1fr)_auto] gap-x-2"
        items-center
      >
        <div class="i-carbon:arrows-vertical" flex-shrink-0 />
        <label for="project-sort" text-sm>
          Sort by
        </label>
        <div class="relative flex-1">
          <select
            id="project-sort"
            ref="sortProjectRef"
            v-model="projectSort"
            w-full
            appearance-none
            bg-base
            text-base
            border="~ base rounded"
            pl-2
            pr-8
            py-1
            text-sm
            cursor-pointer
            hover:bg-active
            class="outline-none"
          >
            <option value="default" class="text-base bg-base">
              Default
            </option>
            <option value="duration-desc" class="text-base bg-base">
              Slowest first
            </option>
            <option value="duration-asc" class="text-base bg-base">
              Fastest first
            </option>
            <option v-if="enableProjects" value="asc" class="text-base bg-base">
              Project A-Z
            </option>
            <option v-if="enableProjects" value="desc" class="text-base bg-base">
              Project Z-A
            </option>
          </select>
          <div class="i-carbon:chevron-down absolute right-2 top-1/2 op50 -translate-y-1/2 pointer-events-none" />
        </div>
        <IconButton
          v-tooltip.bottom="'Reset sort'"
          :disabled="disableClearProjectSort"
          title="Reset sort"
          icon="i-carbon:filter-reset"
          @click.passive="clearProjectSort(true)"
        />
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
          placeholder="Search... (e.g. test name, tag:expression)"
          outline="none"
          bg="transparent"
          font="light"
          text="sm"
          flex-1
          pl-1
          :op="search.length ? '100' : '50'"
          @keydown.esc="clearSearch(false)"
          @keydown.enter="emit('run', isFiltered || isFilteredByStatus ? filteredFiles : undefined)"
        >
        <IconButton
          v-tooltip.bottom="'Clear search'"
          :disabled="disableClearSearch"
          title="Clear search"
          icon="i-carbon:filter-remove"
          @click.passive="clearSearch(true)"
        />
      </div>
      <div
        p="l3 y2 r2"
        items-center
        bg-header
        border="b-2 base"
        flex="~ wrap gap-x-4 justify-between"
      >
        <div min-w-full flex="~ gap-2 items-center">
          <div aria-hidden="true" class="i-carbon:filter" flex-shrink-0 />
          <div flex-grow-1 text-sm>
            Filter
          </div>
          <IconButton
            v-tooltip.bottom="'Clear Filter'"
            :disabled="disableFilter"
            title="Clear filter"
            icon="i-carbon:filter-remove"
            @click.passive="clearFilter(false)"
          />
        </div>
        <FilterStatus v-model="filter.failed" label="Fail" />
        <FilterStatus v-model="filter.success" label="Pass" />
        <FilterStatus v-model="filter.skipped" label="Skip" />
        <FilterStatus v-model="filter.onlyTests" label="Only Tests" />
        <FilterStatus v-model="filter.slow" :label="`Slow${slowTime}`" />
      </div>
    </div>
    <div flex-auto py-1 overflow-hidden>
      <ResultsPanel h-full flex="~ col">
        <template v-if="initialized" #summary>
          <div grid="~ items-center gap-x-1 cols-[auto_min-content_auto] rows-[min-content_min-content]">
            <span text-red-700 dark:text-red-500>
              FAIL ({{ testsTotal.failed }})
            </span>
            <span>/</span>
            <span text-yellow-700 dark:text-yellow-500>
              RUNNING ({{ testsTotal.running }})
            </span>
            <span text-green-700 dark:text-green-500>
              PASS ({{ testsTotal.success }})
            </span>
            <span>/</span>
            <span class="text-purple-700 dark:text-purple-400">
              SKIP ({{ filter.onlyTests ? testsTotal.skipped : '--' }})
            </span>
          </div>
        </template>
        <!-- empty-state -->
        <template v-if="(isFiltered || isFilteredByStatus || !!currentProjectName) && uiEntries.length === 0">
          <div v-if="initialized" flex="~ col" items-center p="x4 y4" font-light>
            <div v-if="searchMatcher.error" text-red text-center>
              {{ searchMatcher.error }}
            </div>
            <div v-else op30>
              No matched test
            </div>
            <button
              type="button"
              font-light
              text-sm
              border="~ gray-400/50 rounded"
              p="x2 y0.5"
              m="t2"
              op="50"
              :class="disableClearSearch ? null : 'hover:op100'"
              :disabled="disableClearSearch"
              @click.passive="clearSearch(true)"
            >
              Clear Search
            </button>
            <button
              type="button"
              font-light
              text-sm
              border="~ gray-400/50 rounded"
              p="x2 y0.5"
              m="t2"
              op="50"
              :class="disableFilter ? null : 'hover:op100'"
              :disabled="disableFilter"
              @click.passive="clearFilter(true)"
            >
              Clear Filter
            </button>
            <button
              type="button"
              font-light
              op="50 hover:100"
              text-sm
              border="~ gray-400/50 rounded"
              p="x2 y0.5"
              m="t2"
              @click.passive="clearAll"
            >
              Clear All
            </button>
          </div>
          <div v-else flex="~ col" items-center p="x4 y4" font-light>
            <div class="i-carbon:circle-dash animate-spin" />
            <div op30>
              Loading...
            </div>
          </div>
        </template>
        <template v-else>
          <RecycleScroller
            ref="scrollerRef"
            class="scrolls"
            flex-auto
            key-field="id"
            role="tree"
            aria-label="Test explorer"
            tabindex="0"
            :aria-activedescendant="ariaActiveTaskId ? `explorer-item-${ariaActiveTaskId}` : undefined"
            :item-size="28"
            :items="uiEntries"
            :buffer="100"
            @scroll.passive="hideAllPoppers"
            @blur="onTreeBlur"
            @focus="onTreeFocus"
            @keydown="onTreeKeydown"
          >
            <template #default="{ item, active }">
              <ExplorerItem
                :id="active ? `explorer-item-${item.id}` : undefined"
                class="h-28px m-0 p-0"
                :task-id="item.id"
                :expandable="item.expandable"
                :type="item.type"
                :current="activeFileId === item.id"
                :role="active ? 'treeitem' : undefined"
                :aria-hidden="active ? undefined : true"
                :aria-level="active ? item.indent + 1 : undefined"
                :aria-posinset="active ? treeItemAria.get(item.id)?.posinset : undefined"
                :aria-setsize="active ? treeItemAria.get(item.id)?.setsize : undefined"
                :aria-expanded="active && item.expandable ? item.expanded : undefined"
                :aria-selected="active ? isSelected(item.id) : undefined"
                :data-active="active && activeTaskId === item.id"
                :indent="item.indent"
                :name="item.name"
                :typecheck="item.typecheck === true"
                :label="item.label"
                :project-name="item.projectName ?? ''"
                :state="item.state"
                :duration="item.duration"
                :slow="item.slow === true"
                :opened="item.expanded"
                :disable-task-location="!includeTaskLocation"
                :class="isSelected(item.id) ? 'bg-active' : ''"
                :on-item-click="onItemClick"
                @click="onTreeItemClick(item.id)"
              />
            </template>
          </RecycleScroller>
        </template>
      </ResultsPanel>
    </div>
  </div>
</template>
