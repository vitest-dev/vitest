import type { RandomSource } from '@vitest/utils/random-source'
import type { File, Suite, Task, Test, VitestRunner, WriteableTestContext } from './types'
import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'

interface AttemptRandom {
  builtin?: RandomSource
  globals?: RandomSource
  user?: { value: unknown }
}

export interface FixtureRandom {
  getKey: (seed: string) => string
  source?: RandomSource
}

const attemptRandoms = new WeakMap<Test, AttemptRandom>()
const taskGlobalsRandoms = new WeakMap<Task, RandomSource>()
const duplicateIndexes = new WeakMap<Task, number>()
const taskKeys = new WeakMap<Task, string>()
let currentFixtureRandom: FixtureRandom | undefined
let parallelHooks = 0

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
      return attempt.user ? attempt.user.value : getBuiltinRandom(test, runner.config.seed, attempt)
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

// `vi.useFakeRandom` takes the values of a test attempt from its `random`, the values of a file
// or worker fixture from the fixture, and the values of other code from the suite or the file
export function getGlobalsRandom(task: Task | undefined, seed: string): RandomSource | undefined {
  if (currentFixtureRandom) {
    return (currentFixtureRandom.source ??= createRandomSource(currentFixtureRandom.getKey(seed)))
  }
  if (!task) {
    return undefined
  }
  if (task.type === 'test') {
    const attempt = getAttemptRandom(task)
    return (attempt.globals ??= getBuiltinRandom(task, seed, attempt).fork('vitest:globals'))
  }
  let random = taskGlobalsRandoms.get(task)
  if (!random) {
    random = createRandomSource(getTaskKey(task, seed)).fork('vitest:globals')
    taskGlobalsRandoms.set(task, random)
  }
  return random
}

export function createFixtureRandom(
  fixture: { name: string; scope: string },
  file: File,
): FixtureRandom {
  return {
    getKey: (seed) =>
      fixture.scope === 'worker'
        ? deriveSeed(['fixture', seed, file.projectName ?? '', fixture.name])
        : deriveSeed(['fixture', getTaskKey(file, seed), fixture.name]),
  }
}

export function setFixtureRandom(random: FixtureRandom | undefined): void {
  currentFixtureRandom = random
}

export async function runParallelHooks<T>(count: number, run: () => Promise<T>): Promise<T> {
  if (count < 2) {
    return run()
  }
  parallelHooks++
  try {
    return await run()
  } finally {
    parallelHooks--
  }
}

export function isRunningParallelHooks(): boolean {
  return parallelHooks > 0
}

function getBuiltinRandom(test: Test, seed: string, attempt: AttemptRandom): RandomSource {
  // the key of the test is its seed
  return (attempt.builtin ??= createRandomSource(getTaskKey(test, seed)))
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
  return createRandomSource(deriveSeed(['shuffle', getTaskKey(suite, runner.config.seed)]))
}

// The key of a task comes from the key of its parent, its name, and its index among siblings
// with the same name. So a task keeps its key when tests are filtered or shuffled, or when
// other suites change.
function getTaskKey(task: Task, seed: string): string {
  let key = taskKeys.get(task)
  if (key == null) {
    const parent = task.suite ?? (task.file === task ? undefined : task.file)
    key = parent
      ? deriveSeed([
          task.type,
          getTaskKey(parent, seed),
          task.name,
          String(duplicateIndexes.get(task) ?? 0),
        ])
      : deriveSeed(['file', seed, task.file.projectName ?? '', task.file.name])
    taskKeys.set(task, key)
  }
  return key
}
