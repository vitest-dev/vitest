import type { Arrayable } from '@vitest/utils'
import type { Suite, Task, Test } from '../types'
import { toArray } from '@vitest/utils/helpers'

/* @__NO_SIDE_EFFECTS__ */
export function isTestCase(s: Task): s is Test {
  return s.type === 'test'
}

/* @__NO_SIDE_EFFECTS__ */
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

/* @__NO_SIDE_EFFECTS__ */
export function getTasks(tasks: Arrayable<Task> = []): Task[] {
  return toArray(tasks).flatMap(s =>
    isTestCase(s) ? [s] : [s, ...getTasks(s.tasks)],
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function getSuites(suite: Arrayable<Task>): Suite[] {
  return toArray(suite).flatMap(s =>
    s.type === 'suite' ? [s, ...getSuites(s.tasks)] : [],
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function hasTests(suite: Arrayable<Suite>): boolean {
  return toArray(suite).some(s =>
    s.tasks.some(c => isTestCase(c) || hasTests(c)),
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function hasFailed(suite: Arrayable<Task>): boolean {
  return toArray(suite).some(
    s =>
      s.result?.state === 'fail' || (s.type === 'suite' && hasFailed(s.tasks)),
  )
}

/* @__NO_SIDE_EFFECTS__ */
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

/* @__NO_SIDE_EFFECTS__ */
export function createTaskName(names: readonly (string | undefined)[], separator = ' > '): string {
  return names.filter(name => name !== undefined).join(separator)
}
