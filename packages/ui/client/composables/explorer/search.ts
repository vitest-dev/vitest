import type { Task } from '@vitest/runner'
import type { Ref } from 'vue'
import {
  allExpanded,
  failedFilter,
  filter,
  filteredFiles,
  isFiltered,
  isFilteredByStatus,
  search,
  skipFilter,
  successFilter,
} from './state'
import type { TreeTaskFilter } from '~/composables/explorer/tree'
import { taskTree, uiEntries } from '~/composables/explorer/tree'
import { caseInsensitiveMatch } from '~/utils/task'
import { client } from '~/composables/client'

export function useSearch(searchBox: Ref<HTMLDivElement | undefined>) {
  const disableFilter = computed(() => {
    if (isFilteredByStatus.value)
      return false

    return !filter.onlyTests
  })
  const disableClearSearch = computed(() => search.value === '')

  const filesTotal = computed<
    { failed: number; success: number; skipped: number; running: number }
  >(() => {
    if (isFiltered.value) {
      const data = filteredFiles.value.reduce((acc, task) => {
        if (task.result?.state === 'fail')
          acc.failed++
        else if (task.result?.state === 'pass')
          acc.success++
        else if (task.mode === 'skip' || task.mode === 'todo')
          acc.skipped++

        return acc
      }, { failed: 0, success: 0, skipped: 0, running: 0 })
      data.running = filteredFiles.value.length - data.failed - data.success - data.skipped
      return data
    }

    return {
      failed: taskTree.summary.filesFailed,
      success: taskTree.summary.filesSuccess,
      skipped: taskTree.summary.filesSkipped,
      running: taskTree.summary.filesRunning,
    }
  })

  const debouncedSearch = ref(search.value)

  debouncedWatch(search, (value) => {
    debouncedSearch.value = value?.trim() ?? ''
  }, { debounce: 256 })

  function clearSearch(focus: boolean) {
    search.value = ''
    focus && searchBox.value?.focus()
  }

  function clearFilter() {
    filter.failed = false
    filter.success = false
    filter.skipped = false
    filter.onlyTests = false
  }

  const showOnlyTests = {
    matcher: node => matchTask(client.state.idMap.get(node.id) as Task),
    showOnlyTests: true,
  } satisfies TreeTaskFilter

  const dontShowOnlyTests = {
    matcher: node => matchTask(client.state.idMap.get(node.id) as Task),
    showOnlyTests: false,
  } satisfies TreeTaskFilter

  const taskId = ref<ReturnType<typeof setTimeout>>()

  watch(() => [
    debouncedSearch.value.length > 0,
    filter.failed,
    filter.success,
    filter.skipped,
    filter.onlyTests,
    allExpanded.value,
  ], ([search, failed, success, skipped, onlyTests, expandAllFlag]) => {
    clearTimeout(taskId.value)
    taskId.value = taskTree.buildNavigationEntries(
      expandAllFlag,
      search || failed || skipped || success ? (onlyTests ? showOnlyTests : dontShowOnlyTests) : undefined,
    )
  }, { flush: 'post' })

  return {
    filter,
    search,
    disableFilter,
    isFiltered,
    isFilteredByStatus,
    disableClearSearch,
    clearSearch,
    clearFilter,
    filesTotal: readonly(filesTotal),
    uiEntries,
  }
}

function matchState(task: Task) {
  if (successFilter.value || failedFilter.value) {
    if ('result' in task) {
      if (successFilter.value && task.result?.state === 'pass')
        return true
      if (failedFilter.value && task.result?.state === 'fail')
        return true
    }
  }

  if (skipFilter.value && 'mode' in task)
    return task.mode === 'skip' || task.mode === 'todo'

  return false
}

function matchTask(task: Task) {
  const match = search.value.length === 0 || caseInsensitiveMatch(task.name, search.value)

  // search and filter will apply together
  if (match) {
    if (successFilter.value || failedFilter.value || skipFilter.value) {
      if (matchState(task))
        return true
    }
    else {
      return true
    }
  }

  return false
}
