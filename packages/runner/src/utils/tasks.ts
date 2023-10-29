import { type Arrayable, toArray } from '@vitest/utils'
import type { Custom, Suite, Task, Test } from '../types'

function isAtomTest(s: Task): s is Test | Custom {
  return s.type === 'test' || s.type === 'custom'
}

export function getTests(suite: Arrayable<Task>): (Test | Custom)[] {
  const tests: (Test | Custom)[] = []
  const arraySuites = toArray(suite)
  for (const s of arraySuites) {
    if (isAtomTest(s)) {
      tests.push(s)
    }
    else {
      for (const task of s.tasks) {
        if (isAtomTest(task))
          tests.push(task)
        else
          tests.push(...getTests(task))
      }
    }
  }
  return tests
}

export function getTasks(tasks: Arrayable<Task> = []): Task[] {
  return toArray(tasks).flatMap(s => isAtomTest(s) ? [s] : [s, ...getTasks(s.tasks)])
}

export function getSuites(suite: Arrayable<Task>): Suite[] {
  return toArray(suite).flatMap(s => s.type === 'suite' ? [s, ...getSuites(s.tasks)] : [])
}

export function hasTests(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s => s.tasks.some(c => isAtomTest(c) || hasTests(c)))
}

export function hasFailed(suite: Arrayable<Task>): boolean {
  return toArray(suite).some(s => s.result?.state === 'fail' || (s.type === 'suite' && hasFailed(s.tasks)))
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
