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
  testsTotal,
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

  const debouncedSearch = ref(search.value)

  debouncedWatch(search, (value) => {
    debouncedSearch.value = value?.trim() ?? ''
  }, { debounce: 256 })

  function clearSearch(focus: boolean) {
    search.value = ''
    focus && searchBox.value?.focus()
  }

  function clearFilter(focus: boolean) {
    filter.failed = false
    filter.success = false
    filter.skipped = false
    filter.onlyTests = false
    focus && searchBox.value?.focus()
  }

  function clearAll() {
    clearFilter(false)
    clearSearch(true)
  }

  const defaultShowOnlyTests: TreeTaskFilter = {
    matcher: node => matchTask(client.state.idMap.get(node.id) as Task),
    showOnlyTests: false,
  }

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
    defaultShowOnlyTests.showOnlyTests = onlyTests
    taskId.value = taskTree.buildNavigationEntries(
      expandAllFlag,
      search || failed || skipped || success ? defaultShowOnlyTests : undefined,
    )
  }, { flush: 'post' })

  return {
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
