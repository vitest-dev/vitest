import { getNames, getTests } from '@vitest/runner/utils'
import type { Suite, Task } from '@vitest/runner'
import type { Arrayable } from '../types/general'
import { toArray } from './base'

export {
  getTasks,
  getTests,
  getSuites,
  hasTests,
  hasFailed,
  getNames,
} from '@vitest/runner/utils'

export function hasBenchmark(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s =>
    s?.tasks?.some(c => c.meta?.benchmark || hasBenchmark(c as Suite)),
  )
}

export function hasFailedSnapshot(suite: Arrayable<Task>): boolean {
  return getTests(suite).some((s) => {
    return s.result?.errors?.some(
      e =>
        typeof e?.message === 'string'
        && e.message.match(/Snapshot .* mismatched/),
    )
  })
}

export function getFullName(task: Task, separator = ' > ') {
  return getNames(task).join(separator)
}

export function getTestName(task: Task, separator = ' > ') {
  return getNames(task).slice(1).join(separator)
}
