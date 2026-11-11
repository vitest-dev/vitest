import type { File, Task, TaskResultAttempt, TestAnnotation } from '../../../runtime/runner/types'
import type { TestError } from '../../../types/general'

// the annotations of the shown runs; a replay often adds the same annotation again
export function getShownAnnotations(
  task: Task,
  attempts: (TaskResultAttempt | undefined)[],
): TestAnnotation[] {
  if (task.type !== 'test') {
    return []
  }
  const shown = new Map<string, TestAnnotation>()
  for (const annotation of task.annotations) {
    const isShownRun =
      annotation.retryIndex == null ||
      attempts.some(
        (attempt) =>
          attempt?.retryIndex === annotation.retryIndex &&
          attempt?.repeatIndex === annotation.repeatIndex,
      )
    const { file, line, column } = annotation.location ?? {}
    const key = `${file}:${line}:${column} ${annotation.type} ${annotation.message}`
    if (isShownRun && !shown.has(key)) {
      shown.set(key, annotation)
    }
  }
  return [...shown.values()]
}

export interface ErrorGroup {
  error: TestError
  sources: ErrorSource[]
  otherMessages?: boolean
}

// with other messages, the shown error comes from the seed of the replay command
export function getShownError(group: ErrorGroup, replaySeed: string | undefined): TestError {
  if (!group.otherMessages) {
    return group.error
  }
  return group.sources.find(({ attempt }) => attempt?.seed === replaySeed)?.error ?? group.error
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
            // other seeds of a test often fail at the same place with other values
            return isSameFailureWithOtherSeed(item, { task, attempt, error })
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
        previous.sources.push({ task, attempt, error })
        if (previous.error.stack !== error.stack || previous.error.diff !== error.diff) {
          previous.otherMessages = true
        }
      } else {
        groups.push({ error, sources: [{ task, attempt, error }] })
      }
    }
  }

  return groups
}

interface ErrorSource {
  task: Task
  // `undefined` for tasks without attempts (suites, files)
  attempt?: TaskResultAttempt
  error: TestError
}

// Seeds of a test with repeats that fail at the same place are 1 failure. The runs of 1 seed
// stay apart when their errors differ: then the seed does not reproduce the failure.
function isSameFailureWithOtherSeed(
  failure: { error: TestError; sources: ErrorSource[] },
  { task, attempt, error }: ErrorSource,
): boolean {
  if (task.type !== 'test' || !task.result?.repeats || !attempt?.seed) {
    return false
  }
  const location = getErrorLocation(error)
  if (
    location == null ||
    error.name !== failure.error.name ||
    location !== getErrorLocation(failure.error)
  ) {
    return false
  }
  return failure.sources.every(
    (source) =>
      source.task === task &&
      source.attempt?.seed &&
      (source.attempt.seed !== attempt.seed ||
        (source.error.stack === error.stack && source.error.diff === error.diff)),
  )
}

function getErrorLocation(error: TestError): string | undefined {
  const frame = error.stacks?.[0]
  return frame && `${frame.file}:${frame.line}:${frame.column}`
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
