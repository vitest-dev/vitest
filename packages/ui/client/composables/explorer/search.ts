import type { ShallowRef } from 'vue'
import { availableProjects } from '~/composables/client'
import { explorerTree } from '~/composables/explorer'
import {
  ALL_PROJECTS,
  currentProject,
  disableClearProjects,
  enableProjects,
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

export function useSearch(
  selectProject: Readonly<ShallowRef<HTMLSelectElement | null>>,
  searchBox: Readonly<ShallowRef<HTMLInputElement | null>>,
) {
  const disableFilter = computed(() => {
    if (isFilteredByStatus.value) {
      return false
    }

    return !filter.onlyTests
  })
  const disableClearSearch = computed(() => search.value === '')
  const debouncedSearch = ref(search.value)

  debouncedWatch(() => search.value, (value) => {
    debouncedSearch.value = value?.trim() ?? ''
  }, { debounce: 256 })

  function clearProject() {
    currentProject.value = ALL_PROJECTS
    selectProject.value?.focus()
  }

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
    if (focus) {
      searchBox.value?.focus()
    }
  }

  function clearAll() {
    clearFilter(false)
    clearSearch(true)
  }

  function updateFilterStorage(
    project: string,
    searchValue: string,
    failedValue: boolean,
    successValue: boolean,
    skippedValue: boolean,
    onlyTestsValue: boolean,
  ) {
    if (!initialized.value) {
      return
    }

    treeFilter.value.project = project?.trim() ?? ''
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
      currentProject.value,
    ] as const,
    ([search, failed, success, skipped, onlyTests, project]) => {
      updateFilterStorage(project, search, failed, success, skipped, onlyTests)
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
    availableProjects,
    enableProjects,
    disableClearProjects,
    currentProject,
    clearProject,
  }
}
