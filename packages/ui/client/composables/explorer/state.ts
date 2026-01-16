import type { File } from '@vitest/runner'
import type { FileTreeNode, Filter, FilteredTests, ProjectSortUIType, TreeFilterState, UITaskTreeNode } from './types'
import { useLocalStorage } from '@vueuse/core'
import { computed, reactive, ref, shallowRef } from 'vue'
import { availableProjects } from '~/composables/client'
import { explorerTree } from './index'

export const uiFiles = shallowRef<FileTreeNode[]>([])
export const uiEntries = shallowRef<UITaskTreeNode[]>([])
export const openedTreeItems = useLocalStorage<string[]>(
  'vitest-ui_task-tree-opened',
  [],
  { shallow: true },
)
export const ALL_PROJECTS = '__vitest_ui_all_projects__'
export const openedTreeItemsSet = computed(() => new Set(openedTreeItems.value))
export const treeFilter = useLocalStorage<TreeFilterState>(
  'vitest-ui_task-tree-filter',
  {
    expandAll: undefined,
    failed: false,
    success: false,
    skipped: false,
    onlyTests: false,
    search: '',
    project: ALL_PROJECTS,
    projectSort: undefined,
  },
)
export const projectSort = ref<ProjectSortUIType>(treeFilter.value.projectSort || 'default')
export const currentProject = shallowRef(treeFilter.value?.project || ALL_PROJECTS)
export const enableProjects = computed(() => availableProjects.value.length > 1)
export const disableClearProjects = computed(() => currentProject.value === ALL_PROJECTS)
export const currentProjectName = computed(() => {
  return !enableProjects.value || currentProject.value === ALL_PROJECTS ? undefined : currentProject.value
})
export const search = ref<string>(treeFilter.value.search)
const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
}
export function escapeHtml(str: string) {
  return str.replace(/[&<>"']/g, m => htmlEntities[m])
}
export const highlightRegex = computed(() => {
  const searchString = search.value.toLowerCase()
  return searchString.length ? new RegExp(`(${escapeHtml(searchString)})`, 'gi') : null
})
export const isFiltered = computed(() => search.value.trim() !== '')
export const filter = reactive<Filter>({
  failed: treeFilter.value.failed,
  success: treeFilter.value.success,
  skipped: treeFilter.value.skipped,
  onlyTests: treeFilter.value.onlyTests,
})
export const isFilteredByStatus = computed(() => {
  if (filter.failed) {
    return true
  }

  if (filter.success) {
    return true
  }

  if (filter.skipped) {
    return true
  }

  return false
})
export const filteredFiles = shallowRef<File[]>([])
export const initialized = ref(false)
export const shouldShowExpandAll = computed(() => {
  const expandAll = treeFilter.value.expandAll
  const opened = openedTreeItems.value

  if (opened.length > 0) {
    return expandAll !== true
  }

  return expandAll !== false
})
export const testsTotal = computed<FilteredTests>(() => {
  const filtered = isFiltered.value
  const filteredByStatus = isFilteredByStatus.value
  const project = currentProjectName.value
  const onlyTests = filter.onlyTests
  const failed = explorerTree.summary.filesFailed
  const success = explorerTree.summary.filesSuccess
  const skipped = explorerTree.summary.filesSkipped
  const running = explorerTree.summary.filesRunning
  const files = filteredFiles.value
  return explorerTree.collectTestsTotal(
    filtered || filteredByStatus || !!project,
    onlyTests,
    files,
    {
      failed,
      success,
      skipped,
      running,
    },
  )
})
