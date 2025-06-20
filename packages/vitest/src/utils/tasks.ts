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
    events.push([suite.id, 'suite-prepare', undefined])
    suite.tasks.forEach((task) => {
      if (task.type === 'suite') {
        visit(task)
      }
      else {
        onTask?.(task)
        if (suite.mode !== 'skip' && suite.mode !== 'todo') {
          packs.push([task.id, task.result, task.meta])
          events.push([task.id, 'test-prepare', undefined])
          task.annotations.forEach((annotation) => {
            events.push([task.id, 'test-annotation', { annotation }])
          })
          events.push([task.id, 'test-finished', undefined])
        }
      }
    })
    events.push([suite.id, 'suite-finished', undefined])
  }

  visit(file)

  return { packs, events }
}
