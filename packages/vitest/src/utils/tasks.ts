import type { Arrayable, Benchmark, Suite, Task, Test } from '../types'
import { toArray } from './base'

export function getTests(suite: Arrayable<Task>): (Test | Benchmark)[] {
  return toArray(suite).flatMap(s => s.type === 'test' || s.type === 'benchmark' ? [s] : s.tasks.flatMap(c => c.type === 'test' ? [c] : getTests(c)))
}

export function getTasks(tasks: Arrayable<Task> = []): Task[] {
  return toArray(tasks).flatMap(s => s.type === 'test' ? [s] : [s, ...getTasks(s.tasks)])
}

export function getSuites(suite: Arrayable<Task>): Suite[] {
  return toArray(suite).flatMap(s => s.type === 'suite' ? [s, ...getSuites(s.tasks)] : [])
}

export function hasTests(suite: Arrayable<Suite | Benchmark>): boolean {
  return toArray(suite).some(s => s.tasks.some(c => ['test', 'benchmark'].includes(c.type) || hasTests(c as Suite | Benchmark)))
}

export function hasBenchmark(suite: Arrayable<Suite | Benchmark>): boolean {
  return toArray(suite).some(s => s.tasks.some(c => c.type === 'benchmark' || hasBenchmark(c as Suite)))
}

export function hasFailed(suite: Arrayable<Task>): boolean {
  return toArray(suite).some(s => s.result?.state === 'fail' || (s.type === 'suite' && hasFailed(s.tasks)))
}

export function hasFailedSnapshot(suite: Arrayable<Task>): boolean {
  return getTests(suite).some((s) => {
    const message = s.result?.error?.message
    return message?.match(/Snapshot .* mismatched/)
  })
}

export function getNames(task: Task) {
  const names = [task.name]
  let current: Task | undefined = task

  while (current?.suite || current?.file) {
    current = current.suite || current.file
    if (current?.name)
      names.unshift(current.name)
  }

  return names
}
