import type { Ref } from 'vue'
import { explorerTree } from '~/composables/explorer'
import {
  filter,
  filteredFiles,
  initialized,
  isFiltered,
  isFilteredByStatus,
  openedTreeItems,
  search,
  testsTotal,
  treeFilter,
  uiEntries,
} from './state'

export function useSearch(searchBox: Ref<HTMLDivElement | undefined>) {
  const disableFilter = computed(() => {
    if (isFilteredByStatus.value) {
      return false
    }

    return !filter.onlyTests
  })
  const disableClearSearch = computed(() => search.value === '')
  const debouncedSearch = ref(search.value)

  const workspaceProjects = computed(() => [...new Set(uiEntries.value.filter(entry => entry.parentId === 'root').map(entry => entry.projectName))])

  debouncedWatch(() => search.value, (value) => {
    debouncedSearch.value = value?.trim() ?? ''
  }, { debounce: 256 })

  function clearSearch(focus: boolean) {
    search.value = ''
    if (focus) {
      searchBox.value?.focus()
    }
  }

  function clearFilter(focus: boolean) {
    filter.failed = false
    filter.success = false
    filter.skipped = false
    filter.onlyTests = false
    filter.project = 'All'
    if (focus) {
      searchBox.value?.focus()
    }
  }

  function clearAll() {
    clearFilter(false)
    clearSearch(true)
  }

  function updateFilterStorage(
    searchValue: string,
    failedValue: boolean,
    successValue: boolean,
    skippedValue: boolean,
    onlyTestsValue: boolean,
  ) {
    if (!initialized.value) {
      return
    }

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
      updateFilterStorage(search, failed, success, skipped, onlyTests)
      explorerTree.filterNodes()
    },
    { flush: 'post' },
  )

  watch(() => openedTreeItems.value.length, (size) => {
    if (size) {
      treeFilter.value.expandAll = undefined
    }
  }, { flush: 'post' })

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
    workspaceProjects,
  }
}
