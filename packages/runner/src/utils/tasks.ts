import type { Arrayable } from '@vitest/utils'
import type { VitestRunner } from '../types/runner'
import type { Suite, Task, Test } from '../types/tasks'
import { toArray } from '@vitest/utils/helpers'

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

export function createTaskName(names: readonly (string | undefined)[], separator = ' > '): string {
  return names.filter(name => name !== undefined).join(separator)
}

export function validateTags(runner: VitestRunner, tags: string[]): void {
  if (!runner.config.strictTags) {
    return
  }

  const availableTags = new Set(runner.config.tags.map(tag => tag.name))
  for (const tag of tags) {
    if (!availableTags.has(tag)) {
      throw createNoTagsError(runner, tag)
    }
  }
}

export function createNoTagsError(runner: VitestRunner, tag: string): never {
  if (!runner.config.tags.length) {
    throw new Error(`The Vitest config does't define any "tags", cannot apply "${tag}" tag for this test. See: https://vitest.dev/guide/test-tags`)
  }
  throw new Error(`Tag "${tag}" is not defined in the configuration. Available tags are:\n${runner.config.tags
    .map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`)
    .join('\n')}`)
}
