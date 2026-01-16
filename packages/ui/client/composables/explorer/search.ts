import type { Ref } from 'vue'
import type { ProjectSortUIType } from '~/composables/explorer/types'
import { debouncedWatch } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { explorerTree } from '~/composables/explorer'
import {
  ALL_PROJECTS,
  currentProject,
  currentProjectName,
  disableClearProjects,
  enableProjects,
  filter,
  filteredFiles,
  initialized,
  isFiltered,
  isFilteredByStatus,
  openedTreeItems,
  projectSort,
  search,
  testsTotal,
  treeFilter,
  uiEntries,
} from './state'

export function useSearch(
  searchBox: Ref<HTMLInputElement | undefined>,
  selectProject: Ref<HTMLSelectElement | undefined>,
  sortProject: Ref<HTMLSelectElement | undefined>,
) {
  const disableFilter = computed(() => {
    if (isFilteredByStatus.value) {
      return false
    }

    return !filter.onlyTests
  })

  const disableClearSearch = computed(() => search.value === '')
  const debouncedSearch = ref(search.value)
  const disableProjectSort = computed(() => currentProject.value !== ALL_PROJECTS)
  const disableClearProjectSort = computed(() => disableProjectSort.value || projectSort.value === 'default')

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
    if (focus) {
      searchBox.value?.focus()
    }
  }

  function clearProject(focus: boolean) {
    currentProject.value = ALL_PROJECTS
    if (focus) {
      selectProject.value?.focus()
    }
  }

  function clearProjectSort(focus: boolean) {
    projectSort.value = 'default'
    if (focus) {
      sortProject.value?.focus()
    }
  }

  function clearAll() {
    clearFilter(false)
    clearSearch(true)
    clearProject(false)
    clearProjectSort(false)
  }

  function updateFilterStorage(
    searchValue: string,
    failedValue: boolean,
    successValue: boolean,
    skippedValue: boolean,
    onlyTestsValue: boolean,
    projectValue: string,
    projectSortValue: ProjectSortUIType,
  ) {
    if (!initialized.value) {
      return
    }

    treeFilter.value.search = searchValue?.trim() ?? ''
    treeFilter.value.failed = failedValue
    treeFilter.value.success = successValue
    treeFilter.value.skipped = skippedValue
    treeFilter.value.onlyTests = onlyTestsValue
    treeFilter.value.project = projectValue
    treeFilter.value.projectSort = projectSortValue === 'default' ? undefined : projectSortValue
  }

  watch(
    () => [
      debouncedSearch.value,
      filter.failed,
      filter.success,
      filter.skipped,
      filter.onlyTests,
      currentProject.value,
      projectSort.value,
    ] as const,
    ([search, failed, success, skipped, onlyTests, project, projectSort]) => {
      updateFilterStorage(
        search,
        failed,
        success,
        skipped,
        onlyTests,
        project,
        projectSort,
      )
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
    enableProjects,
    disableClearProjects,
    currentProject,
    currentProjectName,
    clearProject,
    projectSort,
    disableProjectSort,
    clearProjectSort,
    disableClearProjectSort,
  }
}
