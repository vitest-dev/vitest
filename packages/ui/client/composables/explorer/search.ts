import type { Ref } from 'vue'
import {
  filter,
  filteredFiles,
  initialized,
  isFiltered,
  isFilteredByStatus,
  search,
  testsTotal,
  treeFilter,
  uiEntries,
} from './state'
import { explorerTree } from '~/composables/explorer'

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

  /* const defaultShowOnlyTests: TreeTaskFilter = {
    matcher: node => matchTask(client.state.idMap.get(node.id) as Task),
    showOnlyTests: false,
  }

  const taskId = ref<ReturnType<typeof setTimeout>>() */

  function updateFilterStorage(
    searchValue: string,
    failedValue: boolean,
    successValue: boolean,
    skippedValue: boolean,
    onlyTestsValue: boolean,
  ) {
    if (!initialized.value)
      return

    treeFilter.value.search = searchValue?.trim() ?? ''
    treeFilter.value.failed = failedValue
    treeFilter.value.success = successValue
    treeFilter.value.skipped = skippedValue
    treeFilter.value.onlyTests = onlyTestsValue
  }

  watch(
    () => [
      debouncedSearch.value,
      filter.failed,
      filter.success,
      filter.skipped,
      filter.onlyTests,
    ] as const,
    ([search, failed, success, skipped, onlyTests]) => {
      // clearTimeout(taskId.value)
      // defaultShowOnlyTests.showOnlyTests = onlyTests
      updateFilterStorage(search, failed, success, skipped, onlyTests)
      explorerTree.filterNodes()
      // taskId.value = explorerTree.buildNavigationEntries(
      //   !shouldShowExpandAll.value,
      //   search.length > 0 || failed || skipped || success ? defaultShowOnlyTests : undefined,
      // )
    },
    { flush: 'post' },
  )

  onMounted(() => {
    nextTick(() => (initialized.value = true))
  })

  return {
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
  }
}
/*
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
  // if (!task)
  //   return false

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
*/
