import type { File, Task } from '@vitest/runner'
import type { ComputedRef, Ref } from 'vue'
import { caseInsensitiveMatch, isSuite } from '~/utils/task'
import { files, findById } from '~/composables/client'

interface Filter {
  failed: boolean
  success: boolean
  skipped: boolean
}

const search = ref<string>('')
const isFiltered = computed(() => search.value.trim() !== '')
const filter = reactive(<Filter>{
  failed: false,
  success: false,
  skipped: false,
})
const failedFilter = computed(() => filter.failed)
const successFilter = computed(() => filter.success)
const skipFilter = computed(() => filter.skipped)

export function useSearch(searchBox: Ref<HTMLDivElement | undefined>) {
  const disableFilter = computed(() => !failedFilter.value && !successFilter.value && !skipFilter.value)

  const searchResults = computed(() => {
    return search.value
      ? files.value.filter(file => file.name.toLowerCase().includes(search.value.toLowerCase()))
      : files.value
  })

  const disableClearSearch = computed(() => search.value === '')

  function clearSearch(focus: boolean) {
    search.value = ''
    focus && searchBox.value?.focus()
  }

  function clearFilter() {
    filter.failed = false
    filter.success = false
    filter.skipped = false
  }

  const filtered = computed(() => {
    const useSearch = search.value.trim()
    if (!useSearch && !failedFilter.value && !successFilter.value && !skipFilter.value)
      return files.value

    return files.value.filter(task => matchTasks([findById(task.id) as Task], useSearch, {
      failed: failedFilter.value,
      success: successFilter.value,
      skipped: skipFilter.value,
    }))
  })

  const filteredTests: ComputedRef<File[]> = computed(() => isFiltered.value ? filtered.value.map(task => findById(task.id)!).filter(Boolean) : [])

  return {
    filter,
    search,
    disableFilter,
    isFiltered,
    disableClearSearch,
    clearSearch,
    clearFilter,
    filtered,
    filteredTests,
    searchResults,
  }
}

function matchState(task: Task, filter: Filter) {
  if (filter.success || filter.failed) {
    if ('result' in task) {
      if (filter.success && task.result?.state === 'pass')
        return true
      if (filter.failed && task.result?.state === 'fail')
        return true
    }
  }

  if (filter.skipped && 'mode' in task)
    return task.mode === 'skip' || task.mode === 'todo'

  return false
}

function matchTasks(tasks: Task[], search: string, filter: Filter) {
  let result = false

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    const match = search.length === 0 || caseInsensitiveMatch(task.name, search)

    // search and filter will apply together
    if (match) {
      if (filter.success || filter.failed || filter.skipped) {
        if (matchState(task, filter)) {
          result = true
          break
        }
      }
      else {
        result = true
        break
      }
    }

    // walk whole task tree
    if (isSuite(task) && task.tasks) {
      result = matchTasks(task.tasks, search, filter)
      if (result)
        break
    }
  }

  return result
}

/* async function* searchFiles(canceled: () => boolean, query: string) {
  for (const file of files) {
    if (canceled())
      break
    if (file.name.toLowerCase().includes(query.toLowerCase())) {
    }
    yield * matchTasks([file], query)
  }
}

async function* collect(query: string) {
  for await (const file of searchFiles(query))
    yield file
}

function collectFiles(query: string) {
  return Array.from(collect(query))
} */
