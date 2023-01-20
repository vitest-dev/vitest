import { getNames, getTests } from '@vitest/runner/utils'
import c from 'picocolors'
import type { Arrayable, Suite, Task } from '../types'
import { toArray } from './base'

export { getTasks, getTests, getSuites, hasTests, hasFailed } from '@vitest/runner/utils'

export function hasBenchmark(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s => s?.tasks?.some(c => c.meta?.benchmark || hasBenchmark(c as Suite)))
}

export function hasFailedSnapshot(suite: Arrayable<Task>): boolean {
  return getTests(suite).some((s) => {
    return s.result?.errors?.some(e => e.message.match(/Snapshot .* mismatched/))
  })
}

export function getFullName(task: Task) {
  return getNames(task).join(c.dim(' > '))
}
