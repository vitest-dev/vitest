import type { File, Task } from '@vitest/runner'
import type { ComputedRef, Ref } from 'vue'
import { caseInsensitiveMatch } from '~/utils/task'
import { files, findById } from '~/composables/client'
import { dirty, setDirty, uiEntries } from '~/composables/client/state'
import type { UIEntry } from '~/composables/client/types'
// import { UIEntry } from '~/composables/client/types'

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
// don't remove these computed, reactive filter is not working inside computed filtered
const failedFilter = computed(() => filter.failed)
const successFilter = computed(() => filter.success)
const skipFilter = computed(() => filter.skipped)
const isFilteredByStatus = computed(() => failedFilter.value || successFilter.value || skipFilter.value)

export function useSearchTasks(task: Ref<Task>) {
  const filteredTasks = computed(() => {
    const useSearch = search.value.trim()
    const tasks = task.value && 'tasks' in task.value ? task.value.tasks : []
    if (!useSearch && !failedFilter.value && !successFilter.value && !skipFilter.value)
      return tasks

    return tasks.filter(task => matchTasks([task], useSearch, {
      failed: failedFilter.value,
      success: successFilter.value,
      skipped: skipFilter.value,
    }))
  })

  return { filteredTasks }
}

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
    if (dirty.value === 0)
      return []

    const useSearch = search.value.trim()
    if (!useSearch && !failedFilter.value && !successFilter.value && !skipFilter.value) {
      const match = uiEntries.value.filter(entry => !('parentUI' in entry) || ('expanded' in entry && entry.expanded))
      return uiEntries.value.filter(entry => match.includes(entry) || match.some(i => 'parentUI' in i && i.parentUI === entry.id))
    }

    const match = uiEntries.value
      .filter(entry => 'parentUI' in entry && matchTask(findById(entry.id) as Task, useSearch, {
        failed: failedFilter.value,
        success: successFilter.value,
        skipped: skipFilter.value,
      }))

    const result = uiEntries.value.filter((entry) => {
      if (match.includes(entry))
        return true

      return match.some(i => 'parentUI' in i && i.parentUI === entry.id)

      // todo: include parents in the children: rn only first level
    })

    let entry: UIEntry
    for (let i = 0; i < result.length; i++) {
      entry = result[i]
      if ('expanded' in entry)
        entry.expanded = true
    }

    return result

    /*   return uiEntries.value.filter(task => matchTasks([findById(task.id) as Task], useSearch, {
      failed: failedFilter.value,
      success: successFilter.value,
      skipped: skipFilter.value,
    })) */
  })

  const filteredTests: ComputedRef<File[]> = computed(() => isFiltered.value ? filtered.value.map(task => findById(task.id)!).filter(Boolean) : [])

  return {
    filter,
    search,
    disableFilter,
    isFiltered,
    isFilteredByStatus,
    disableClearSearch,
    clearSearch,
    clearFilter,
    filtered,
    filteredTests,
    searchResults,
    setDirty,
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

function matchTask(task: Task, search: string, filter: Filter) {
  const match = search.length === 0 || caseInsensitiveMatch(task.name, search)

  // search and filter will apply together
  if (match) {
    if (filter.success || filter.failed || filter.skipped) {
      if (matchState(task, filter))
        return true
    }
    else {
      return true
    }
  }

  return false
}
