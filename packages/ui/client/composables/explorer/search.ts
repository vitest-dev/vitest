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
      updateFilterStorage(search, failed, success, skipped, onlyTests)
      explorerTree.filterNodes()
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
