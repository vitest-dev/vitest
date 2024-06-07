<script setup lang="ts">
import type { ComputedRef } from 'vue'
import type { File, Task } from 'vitest'
import { files, findById } from '~/composables/client'
import { activeFileId } from '~/composables/params'
import { caseInsensitiveMatch, isSuite } from '~/utils/task'

const { onItemClick } = defineProps<{
  onItemClick?: (task: Task) => void
}>()

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  (event: 'item-click', files?: File[]): void
  (event: 'run', files?: File[]): void
}>()

const search = ref<string>('')
const searchBox = ref<HTMLInputElement | undefined>()
const isFiltered = computed(() => search.value.trim() !== '')

const filtered = computed(() => {
  if (!search.value.trim())
    return files.value

  return files.value.filter(task => matchTasks([task as Task], search.value))
})
const filteredTests: ComputedRef<File[]> = computed(() => isFiltered.value ? filtered.value.map(task => findById(task.id)!).filter(Boolean) : [])

const { list, containerProps, wrapperProps } = useVirtualList(filtered, {
  itemHeight: 28,
})

const disableClearSearch = computed(() => search.value === '')

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
    <div class="scrolls" flex-auto py-1 v-bind="containerProps">
      <DetailsPanel v-bind="wrapperProps">
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
      </DetailsPanel>
    </div>
  </div>
</template>
