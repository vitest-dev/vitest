import type { File } from '@vitest/runner'
import type { Filter } from './types'
import type { FilteredTests } from '~/composables/explorer/tree'
import { taskTree } from '~/composables/explorer/tree'

export const search = ref<string>('')
export const allExpanded = ref<boolean>(false)
export const isFiltered = computed(() => search.value.trim() !== '')
export const filter = reactive({
  failed: false,
  success: false,
  skipped: false,
  onlyTests: false,
} satisfies Filter)
export const failedFilter = computed(() => filter.failed)
export const successFilter = computed(() => filter.success)
export const skipFilter = computed(() => filter.skipped)
export const onlyTestsFilter = computed(() => filter.onlyTests)
export const isFilteredByStatus = computed(() => {
  if (filter.failed)
    return true

  if (filter.success)
    return true

  if (filter.skipped)
    return true

  return false
})
export const filteredFiles = shallowRef<File[]>([])
export const testsTotal = computed<FilteredTests>(() => {
  const filtered = isFiltered.value
  const filteredByStatus = isFilteredByStatus.value
  const onlyTests = filter.onlyTests
  const failed = taskTree.summary.filesFailed
  const success = taskTree.summary.filesSuccess
  const skipped = taskTree.summary.filesSkipped
  const running = taskTree.summary.filesRunning
  const files = filteredFiles.value
  return taskTree.collectTestsTotal(
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
