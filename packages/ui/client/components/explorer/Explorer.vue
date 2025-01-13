<script setup lang="ts">
import type { File, Task } from '@vitest/runner'
import { hideAllPoppers } from 'floating-vue'

// @ts-expect-error missing types
import { RecycleScroller } from 'vue-virtual-scroller'

import { config } from '~/composables/client'
import { useSearch } from '~/composables/explorer/search'

import { panels } from '~/composables/navigation'
import { activeFileId } from '~/composables/params'

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

const searchBox = ref<HTMLInputElement | undefined>()

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
  workspaceProjects,
} = useSearch(searchBox)

const filterClass = ref<string>('grid-cols-2')
const filterHeaderClass = ref<string>('grid-col-span-2')
const testExplorerRef = ref<HTMLInputElement | undefined>()

const { width: windowWidth } = useWindowSize()

watch(() => windowWidth.value * (panels.navigation / 100), (width) => {
  if (width < 420) {
    filterClass.value = 'grid-cols-2'
    filterHeaderClass.value = 'grid-col-span-2'
  }
  else {
    filterClass.value = 'grid-cols-4'
    filterHeaderClass.value = 'grid-col-span-4'
  }
})
</script>

<template>
  <div ref="testExplorerRef" h="full" flex="~ col">
    <div>
      <div p="2" h-10 flex="~ gap-2" items-center bg-header border="b base">
        <slot name="header" :filtered-files="isFiltered || isFilteredByStatus ? filteredFiles : undefined" />
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
        grid="~ items-center gap-x-2 rows-[auto_auto]"
        :class="filterClass"
      >
        <div :class="filterHeaderClass" flex="~ gap-2 items-center">
          <div aria-hidden="true" class="i-carbon:filter" />
          <div flex-grow-1 text-sm>
            Filter
          </div>
          <IconButton
            v-tooltip.bottom="'Clear Filter'"
            :disabled="disableFilter"
            title="Clear search"
            icon="i-carbon:filter-remove"
            @click.passive="clearFilter(false)"
          />
        </div>
        <FilterStatus v-model="filter.failed" label="Fail" />
        <FilterStatus v-model="filter.success" label="Pass" />
        <FilterStatus v-model="filter.skipped" label="Skip" />
        <FilterStatus v-model="filter.onlyTests" label="Only Tests" />
        <FilterSelect v-model="filter.project" :options="(workspaceProjects as string[])" @update="(e) => console.log(e)" />
      </div>
    </div>
    <div class="scrolls" flex-auto py-1 @scroll.passive="hideAllPoppers">
      <DetailsPanel>
        <template v-if="initialized" #summary>
          <div grid="~ items-center gap-x-1 cols-[auto_min-content_auto] rows-[min-content_min-content]">
            <span text-red5>
              FAIL ({{ testsTotal.failed }})
            </span>
            <span>/</span>
            <span text-yellow5>
              RUNNING ({{ testsTotal.running }})
            </span>
            <span text-green5>
              PASS ({{ testsTotal.success }})
            </span>
            <span>/</span>
            <span class="text-purple5:50">
              SKIP ({{ filter.onlyTests ? testsTotal.skipped : '--' }})
            </span>
          </div>
        </template>
        <!-- empty-state -->
        <template v-if="(isFiltered || isFilteredByStatus) && uiEntries.length === 0">
          <div v-if="initialized" flex="~ col" items-center p="x4 y4" font-light>
            <div op30>
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
                :opened="item.expanded"
                :disable-task-location="!includeTaskLocation"
                :class="activeFileId === item.id ? 'bg-active' : ''"
                :on-item-click="onItemClick"
              />
            </template>
          </RecycleScroller>
        </template>
      </DetailsPanel>
    </div>
  </div>
</template>
