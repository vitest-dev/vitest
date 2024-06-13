import type { File } from '@vitest/runner'
import type { Filter } from './types'

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
export const filteredFiles = ref<File[]>([])
