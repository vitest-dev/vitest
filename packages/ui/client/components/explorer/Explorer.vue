<script setup lang="ts">
import type { File, Task } from '@vitest/runner'
import { activeFileId } from '~/composables/params'
import { useSearch } from '~/composables/explorer/search'
// @ts-expect-error missing types
import { RecycleScroller } from 'vue-virtual-scroller'

import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const { onItemClick } = defineProps<{
  onItemClick?: (task: Task) => void
}>()

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  (event: 'item-click', files?: File[]): void
  (event: 'run', files?: File[]): void
}>()

const searchBox = ref<HTMLInputElement | undefined>()

const {
  filter,
  search,
  disableFilter,
  isFiltered,
  isFilteredByStatus,
  disableClearSearch,
  clearSearch,
  clearFilter,
  filteredFiles,
  testsTotal,
  uiEntries,
} = useSearch(searchBox)

const filterClass = ref<string>('grid-cols-2')
const filterHeaderClass = ref<string>('grid-col-span-2')
const testExplorerRef = ref<HTMLInputElement | undefined>()

useResizeObserver(testExplorerRef, (entries) => {
  const { width } = entries[0].contentRect
  if (width < 420) {
    filterClass.value = 'grid-cols-2'
    filterHeaderClass.value = 'grid-col-span-2'
  } else {
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
          <div aria-hidden="true" class="i-carbon:filter"></div>
          <div flex-grow-1>Filter</div>
          <IconButton
            v-tooltip.bottom="'Clear Filter'"
            :disabled="disableFilter"
            title="Clear search"
            icon="i-carbon:filter-remove"
            @click.passive="clearFilter()"
          />
        </div>
        <FilterStatus label="Fail" v-model="filter.failed" />
        <FilterStatus label="Pass" v-model="filter.success" />
        <FilterStatus label="Skip" v-model="filter.skipped" />
        <FilterStatus label="Only Tests" v-model="filter.onlyTests" />
      </div>
    </div>
    <div class="scrolls" flex-auto py-1>
      <DetailsPanel>
        <template #summary>
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
              SKIP ({{ filter.onlyTests ? testsTotal.skipped: '--' }})
            </span>
          </div>
        </template>
        <!-- empty-state -->
        <template v-if="(isFiltered || isFilteredByStatus) && uiEntries.length === 0">
          <div flex="~ col" items-center p="x4 y4" font-light>
            <div op30>
              No matched test
            </div>
            <button
              type="button"
              font-light
              op="50 hover:100"
              text-sm
              border="~ gray-400/50 rounded"
              p="x2 y0.5"
              m="t2"
              @click.passive="clearSearch(true)"
            >
              Clear Search
            </button>
          </div>
        </template>
        <template v-else>
          <RecycleScroller
            page-mode
            key-field="id"
            :item-size="28"
            :items="uiEntries"
          >
<!--            <DynamicScrollerItem
              :item="item"
              :data-id="item.id"
              :active="active"
            >-->
            <template #default="{ item }">
              <ExplorerItem
                :task-id="item.id"
                :entry="item"
                :search="search"
                class="h-28px m-0 p-0"
                :class="activeFileId === item.id ? 'bg-active' : ''"
                :on-item-click="onItemClick"
              />
            </template>
<!--            </DynamicScrollerItem>-->
          </RecycleScroller>
        </template>
      </DetailsPanel>
    </div>
  </div>
</template>
