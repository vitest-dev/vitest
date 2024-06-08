<script setup lang="ts">
import type { ComputedRef } from 'vue'
import type { File, Task } from 'vitest'
import { files, findById } from '~/composables/client'
import { activeFileId } from '~/composables/params'
import { caseInsensitiveMatch, isSuite } from '~/utils/task'
import { testStatus } from '~/composables/summary'
import { useSearch } from '~/composables/seach'

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
  search,
  isFiltered,
  filter,
  disableFilter,
  filtered,
  filteredTests,
  disableClearSearch,
  clearSearch,
  clearFilter,
} = useSearch(searchBox)

// todo: remove this and include custom component to filter tests
const failed = computed(() => isFiltered.value ? filteredTests.value.filter(task => task.result?.state === 'fail').length : testStatus.filesFailed)
const success = computed(() => isFiltered.value ? filteredTests.value.filter(task => task.result?.state === 'pass').length : testStatus.filesSuccess)
const skipped = computed(() => isFiltered.value ? filteredTests.value.filter(task => task.mode === 'skip' || task.mode === 'todo').length : testStatus.filesSkipped)
const running = computed(() => isFiltered.value ? filteredTests.value.length - failed.value - success.value - skipped.value : testStatus.filesRunning)

const { list, containerProps, wrapperProps } = useVirtualList(filtered, {
  itemHeight: 28,
})

const filterClass = ref<string>('grid-cols-2')
const filterHeaderClass = ref<string>('grid-col-span-2')
const testExplorerRef = ref<HTMLInputElement | undefined>()

useResizeObserver(testExplorerRef, (entries) => {
  const { width } = entries[0].contentRect
  if (width < 300) {
    filterClass.value = 'grid-cols-2'
    filterHeaderClass.value = 'grid-col-span-2'
  } else {
    filterClass.value = 'grid-cols-3'
    filterHeaderClass.value = 'grid-col-span-3'
  }
})
</script>

<template>
  <div ref="testExplorerRef" h="full" flex="~ col">
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
      </div>
    </div>
    <div class="scrolls" flex-auto py-1 v-bind="containerProps">
      <DetailsPanel v-bind="wrapperProps">
        <template #summary>
          <div grid="~ items-center gap-x-1 cols-[auto_min-content_auto] rows-[min-content_min-content]">
            <span text-red5>
              FAIL ({{ failed }})
            </span>
            <span>/</span>
            <span text-yellow5>
              RUNNING ({{ running }})
            </span>
            <span text-green5>
              PASS ({{ success }})
            </span>
            <span>/</span>
            <span class="text-purple5:50">
              SKIP ({{ skipped }})
            </span>
          </div>
        </template>
        <!-- empty-state -->
        <template v-if="isFiltered && filtered.length === 0">
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
          <TaskTree
            v-for="file in list"
            :key="file.index"
            nested
            :task-id="file.data.id"
            :search="search"
            :opened="isFiltered"
            :class="activeFileId === file.data.id ? 'bg-active' : ''"
            :on-item-click="onItemClick"
          />
        </template>
      </DetailsPanel>
    </div>
  </div>
</template>
