import type { Ref } from 'vue'
import type { ErrorWithDiff } from '@vitest/utils'
import type { Task } from '@vitest/runner'
import type { File } from 'vitest'
import type { RunState } from '../../../types'
import type { UIEntry, UIFile, UISuite, UITest } from '~/composables/client/types'
import { findById } from '~/composables/client/index'
import { isSuite } from '~/utils/task'

export const testRunState: Ref<RunState> = ref('idle')
export const files = shallowRef<UIFile[]>([])
export const uiEntries = shallowRef<UIEntry[]>([])
export const finished = computed(() => testRunState.value === 'idle')
export const unhandledErrors: Ref<ErrorWithDiff[]> = ref([])

export const dirty = ref(0)

export function setDirty() {
  dirty.value = dirty.value > 100 ? 1 : dirty.value + 1
}

export function prepareUIEntries(remoteFiles: File[]) {
  const useFiles = remoteFiles.map<UIFile>(file => ({
    id: file.id,
    name: file.name,
    mode: file.mode,
    state: file.result?.state,
    filepath: file.filepath,
    projectName: file.projectName || '',
    collectDuration: file.collectDuration,
    setupDuration: file.setupDuration,
    expanded: false,
  })).sort((a, b) => {
    return a.name.localeCompare(b.name)
  })
  const entries: UIEntry[] = []
  for (let i = 0; i < useFiles.length; i++) {
    const file = useFiles[i]
    entries.push(file)
    const tasks = findById(file.id)!.tasks
    const children: UIEntry[] = sortChildren(file.id, tasks)
    for (let j = 0; j < tasks.length; j++) {
      entries.push(children[j])
      if (isSuite(tasks[j]))
        collectChildren(tasks, entries)
    }
  }
  uiEntries.value = entries
  files.value = useFiles
  setDirty()
}

function collectChildren(tasks: Task[], entries: UIEntry[]) {
  let task: Task
  for (let i = 0; i < tasks.length; i++) {
    task = tasks[i]
    if ('tasks' in task) {
      const children = sortChildren(task.id, task.tasks)
      let subTask: Task
      for (let j = 0; j < tasks.length; j++) {
        subTask = tasks[j]
        entries.push(children[j])
        if ('tasks' in subTask)
          collectChildren(subTask.tasks, entries)
      }
    }
  }
}

function sortChildren(parent: string, tasks: Task[]) {
  const children: UIEntry[] = []
  let task: Task
  for (let i = 0; i < tasks.length; i++) {
    task = tasks[i]
    if ('tasks' in task) {
      children.push(<UISuite>{
        id: task.id,
        name: task.name,
        mode: task.mode,
        parentUI: parent,
        expanded: false,
      })
    }
    else {
      children.push(<UITest>{
        id: task.id,
        name: task.name,
        mode: task.mode,
        parentUI: parent,
      })
    }
  }

  return children.sort((a, b) => a.name.localeCompare(b.name))
}
