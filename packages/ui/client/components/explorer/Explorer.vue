<script setup lang="ts">
import type { File, Task } from '@vitest/runner'
import { hideAllPoppers } from 'floating-vue'
import { computed, ref } from 'vue'

// @ts-expect-error missing types
import { RecycleScroller } from 'vue-virtual-scroller'
import { availableProjects, config } from '~/composables/client'
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
    <div class="scrolls" flex-auto py-1 @scroll.passive="hideAllPoppers">
      <ResultsPanel>
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
            page-mode
            key-field="id"
            :item-size="28"
            :items="uiEntries"
            :buffer="100"
          >
            <template #default="{ item }">
              <ExplorerItem
                class="h-28px m-0 p-0"
                :task-id="item.id"
                :expandable="item.expandable"
                :type="item.type"
                :current="activeFileId === item.id"
                :indent="item.indent"
                :name="item.name"
                :typecheck="item.typecheck === true"
                :project-name="item.projectName ?? ''"
                :project-name-color="item.projectNameColor ?? ''"
                :state="item.state"
                :duration="item.duration"
                :slow="item.slow === true"
                :opened="item.expanded"
                :disable-task-location="!includeTaskLocation"
                :class="selectedTest === item.id || (!selectedTest && activeFileId === item.id) ? 'bg-active' : ''"
                :on-item-click="onItemClick"
              />
            </template>
          </RecycleScroller>
        </template>
      </ResultsPanel>
    </div>
  </div>
</template>
