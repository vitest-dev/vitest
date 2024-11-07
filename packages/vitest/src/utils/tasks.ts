import type { Suite, Task } from '@vitest/runner'
import type { Arrayable } from '../types/general'
import { getTests } from '@vitest/runner/utils'
import { toArray } from '@vitest/utils'

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
