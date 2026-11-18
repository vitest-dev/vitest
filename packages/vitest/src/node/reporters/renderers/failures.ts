import type { File, Task, TaskResultAttempt } from '../../../runtime/runner/types'
import type { TestError } from '../../../types/general'

export interface ErrorGroup {
  error: TestError
  sources: ErrorSource[]
}

export function groupTaskErrors(tasks: Task[]): ErrorGroup[] {
  const groups: ErrorGroup[] = []

  for (const task of tasks) {
    // Merge identical errors
    for (const { error, attempt } of getErrorsWithAttempt(task)) {
      let previous: ErrorGroup | undefined

      if (error.stack) {
        previous = groups.find((item) => {
          if (item.error.stack !== error.stack || item.error.diff !== error.diff) {
            return false
          }

          const itemTask = item.sources[0].task
          const currentProjectName = (task as File)?.projectName || task.file?.projectName || ''
          const projectName = (itemTask as File)?.projectName || itemTask.file?.projectName || ''

          const currentAnnotations = task.type === 'test' && task.annotations
          const itemAnnotations = itemTask.type === 'test' && itemTask.annotations

          return (
            projectName === currentProjectName && deepEqual(currentAnnotations, itemAnnotations)
          )
        })
      }

      if (previous) {
        previous.sources.push({ task, attempt })
      } else {
        groups.push({ error, sources: [{ task, attempt }] })
      }
    }
  }

  return groups
}

interface ErrorSource {
  task: Task
  // `undefined` for tasks without attempts (suites, files)
  attempt?: TaskResultAttempt
}

function getErrorsWithAttempt(task: Task): { error: TestError; attempt?: TaskResultAttempt }[] {
  const attempts = task.result?.attempts
  if (!attempts?.length) {
    return (task.result?.errors ?? []).map((error) => ({ error }))
  }
  return attempts.flatMap((attempt) => (attempt.errors ?? []).map((error) => ({ error, attempt })))
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) {
    return false
  }

  for (const key of keysA) {
    if (!Object.hasOwn(b, key) || !deepEqual(a[key], b[key])) {
      return false
    }
  }
  return true
}
