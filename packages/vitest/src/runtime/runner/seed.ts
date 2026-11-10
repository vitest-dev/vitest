import type { RandomSource } from '@vitest/utils/random-source'
import type { Suite, Task, Test, VitestRunner, WriteableTestContext } from './types'
import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'

interface AttemptRandom {
  builtin?: RandomSource
  user?: { value: unknown }
}

const attemptRandoms = new WeakMap<Test, AttemptRandom>()
const duplicateIndexes = new WeakMap<Task, number>()
const taskKeys = new WeakMap<Task, string>()

export function defineRandomContext(
  context: WriteableTestContext,
  test: Test,
  runner: VitestRunner,
): void {
  // this is to avoid breaking changes and allow user's `random` fixtures
  Object.defineProperty(context, 'random', {
    configurable: true,
    get() {
      const attempt = getAttemptRandom(test)
      if (attempt.user) {
        return attempt.user.value
      }
      attempt.builtin ??= createRandomSource(getTestSeed(test, runner))
      return attempt.builtin
    },
    // a user fixture with the same name replaces the built-in value until the next attempt
    set(value: unknown) {
      getAttemptRandom(test).user = { value }
    },
  })
}

export function startSeedAttempt(test: Test): void {
  attemptRandoms.set(test, {})
}

export function getAttemptSeed(test: Test): string | undefined {
  return attemptRandoms.get(test)?.builtin?.seed
}

function getAttemptRandom(test: Test): AttemptRandom {
  let attempt = attemptRandoms.get(test)
  if (!attempt) {
    attempt = {}
    attemptRandoms.set(test, attempt)
  }
  return attempt
}

// tasks with the same name in one suite need different seeds
export function recordDuplicateIndex(names: Map<string, number>, task: Task): void {
  const index = names.get(task.name) ?? 0
  names.set(task.name, index + 1)
  if (index > 0) {
    duplicateIndexes.set(task, index)
  }
}

export function createShuffleRandom(suite: Suite, runner: VitestRunner): RandomSource {
  return createRandomSource(deriveSeed(['shuffle', getTaskKey(suite, runner)]))
}

function getTestSeed(test: Test, runner: VitestRunner): string {
  // the last part is the index of the seed within the test
  return deriveSeed(['random', getTaskKey(test, runner), '0'])
}

function getTaskKey(task: Task, runner: VitestRunner): string {
  let key = taskKeys.get(task)
  if (key == null) {
    const parent = task.suite ?? (task.file === task ? undefined : task.file)
    key = parent
      ? deriveSeed([
          task.type,
          getTaskKey(parent, runner),
          task.name,
          String(duplicateIndexes.get(task) ?? 0),
        ])
      : deriveSeed([
          'file',
          String(runner.config.seed),
          task.file.projectName ?? '',
          task.file.name,
        ])
    taskKeys.set(task, key)
  }
  return key
}
