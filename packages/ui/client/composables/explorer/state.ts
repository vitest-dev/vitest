import type { File, Task } from '@vitest/runner'
import type { FileTreeNode, Filter, FilteredTests, TreeFilterState, UITaskTreeNode } from './types'
import { createTagsFilter } from '@vitest/runner/utils'
import { useLocalStorage } from '@vueuse/core'
import { computed, reactive, ref, shallowRef } from 'vue'
import { caseInsensitiveMatch } from '~/utils/task'
import { config } from '../client'
import { explorerTree } from './index'

export const uiFiles = shallowRef<FileTreeNode[]>([])
export const uiEntries = shallowRef<UITaskTreeNode[]>([])
export const openedTreeItems = useLocalStorage<string[]>(
  'vitest-ui_task-tree-opened',
  [],
  { shallow: true },
)
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
  },
)
export const search = ref<string>(treeFilter.value.search)
const tagExpressionsCache = new Map<string, { error?: string; matcher: (tags: string[]) => boolean }>()
export const searchMatcher = computed(() => {
  if (search.value.startsWith('tag:')) {
    if (!config.value.tags) { // config is not loaded yet
      return { matcher: () => true }
    }
    const tagQuery = search.value.slice(4).trim()
    let filter = tagExpressionsCache.get(tagQuery)
    if (!filter) {
      filter = createSafeFilter(tagQuery)
      tagExpressionsCache.set(tagQuery, filter)
    }
    return {
      matcher: (task: Task) => filter.matcher(task.tags || []),
      error: filter.error,
    }
  }
  return {
    matcher: (task: Task) => search.value === '' || caseInsensitiveMatch(task.name, search.value),
  }
})

function createSafeFilter(
  query: string,
) {
  if (!query) {
    return { matcher: () => true }
  }
  try {
    return { matcher: createTagsFilter([query], config.value.tags) }
  }
  catch (error: any) {
    return { matcher: () => false, error: error.message }
  }
}
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
  const onlyTests = filter.onlyTests
  const failed = explorerTree.summary.filesFailed
  const success = explorerTree.summary.filesSuccess
  const skipped = explorerTree.summary.filesSkipped
  const running = explorerTree.summary.filesRunning
  const files = filteredFiles.value
  return explorerTree.collectTestsTotal(
    filtered || filteredByStatus,
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
