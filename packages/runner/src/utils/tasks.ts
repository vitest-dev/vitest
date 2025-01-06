import type { Suite, Task, Test } from '../types/tasks'
import { type Arrayable, toArray } from '@vitest/utils'

/**
 * @deprecated use `isTestCase` instead
 */
export function isAtomTest(s: Task): s is Test {
  return isTestCase(s)
}

export function isTestCase(s: Task): s is Test {
  return s.type === 'test'
}

export function getTests(suite: Arrayable<Task>): Test[] {
  const tests: Test[] = []
  const arraySuites = toArray(suite)
  for (const s of arraySuites) {
    if (isTestCase(s)) {
      tests.push(s)
    }
    else {
      for (const task of s.tasks) {
        if (isTestCase(task)) {
          tests.push(task)
        }
        else {
          const taskTests = getTests(task)
          for (const test of taskTests) {
            tests.push(test)
          }
        }
      }
    }
  }
  return tests
}

export function getTasks(tasks: Arrayable<Task> = []): Task[] {
  return toArray(tasks).flatMap(s =>
    isTestCase(s) ? [s] : [s, ...getTasks(s.tasks)],
  )
}

export function getSuites(suite: Arrayable<Task>): Suite[] {
  return toArray(suite).flatMap(s =>
    s.type === 'suite' ? [s, ...getSuites(s.tasks)] : [],
  )
}

export function hasTests(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s =>
    s.tasks.some(c => isTestCase(c) || hasTests(c)),
  )
}

export function hasFailed(suite: Arrayable<Task>): boolean {
  return toArray(suite).some(
    s =>
      s.result?.state === 'fail' || (s.type === 'suite' && hasFailed(s.tasks)),
  )
}

export function getNames(task: Task): string[] {
  const names = [task.name]
  let current: Task | undefined = task

  while (current?.suite) {
    current = current.suite
    if (current?.name) {
      names.unshift(current.name)
    }
  }

  if (current !== task.file) {
    names.unshift(task.file.name)
  }

  return names
}

export function getFullName(task: Task, separator = ' > '): string {
  return getNames(task).join(separator)
}

export function getTestName(task: Task, separator = ' > '): string {
  return getNames(task).slice(1).join(separator)
}
