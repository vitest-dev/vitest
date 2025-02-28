import type { File, Suite, Task, TaskEventPack, TaskResultPack } from '@vitest/runner'
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

export function convertTasksToEvents(file: File, onTask?: (task: Task) => void): {
  packs: TaskResultPack[]
  events: TaskEventPack[]
} {
  const packs: TaskResultPack[] = []
  const events: TaskEventPack[] = []

  function visit(suite: Suite | File) {
    onTask?.(suite)

    packs.push([suite.id, suite.result, suite.meta])
    events.push([suite.id, 'suite-prepare'])
    suite.tasks.forEach((task) => {
      if (task.type === 'suite') {
        visit(task)
      }
      else {
        onTask?.(task)
        packs.push([task.id, task.result, task.meta])
        if (task.mode !== 'skip' && task.mode !== 'todo') {
          events.push([task.id, 'test-prepare'], [task.id, 'test-finished'])
        }
      }
    })
    events.push([suite.id, 'suite-finished'])
  }

  visit(file)

  return { packs, events }
}
