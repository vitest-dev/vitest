import type { RandomSource } from '@vitest/utils/random-source'
import type { SerializedConfig } from '../config'
import type {
  File,
  Suite,
  Task,
  TaskResultRepeats,
  Test,
  TestOptions,
  VitestRunner,
  WriteableTestContext,
} from './types'
import { createRandomSource, deriveSeed, isSeed } from '@vitest/utils/random-source'

interface AttemptRandom {
  seed?: string
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

export function startSeedAttempt(test: Test, seed: string | undefined): void {
  attemptRandoms.set(test, { seed })
}

export function createRepeatsResult(
  test: Test,
  config: SerializedConfig,
): TaskResultRepeats | undefined {
  if (!test.repeats || config.replaySeed) {
    return undefined
  }
  return {
    // the key of the test, so the first repeat after `include` has the values of the test without `repeats`
    base: getTaskKey(test, config.seed),
    include: test.includeSeeds ?? [],
    startTimes: [],
    durations: [],
    seeded: [],
  }
}

// each seed in `include` adds 1 run
export function resolveTestRepeats(option: TestOptions['repeats']): {
  repeats: number | undefined
  includeSeeds?: string[]
} {
  if (option == null || typeof option === 'number') {
    return { repeats: option }
  }
  if (typeof option !== 'object') {
    throw new TypeError(
      `The "repeats" option must be a number or an object, received ${JSON.stringify(option)}.`,
    )
  }
  const count = option.count ?? 0
  const include = option.include ?? []
  if (!Number.isInteger(count) || count < 0) {
    throw new TypeError(`"repeats.count" must be a non-negative integer, received ${count}.`)
  }
  if (!Array.isArray(include)) {
    throw new TypeError(
      `"repeats.include" must be an array of seeds, received ${JSON.stringify(include)}.`,
    )
  }
  const includeSeeds: string[] = []
  for (const seed of include) {
    if (!isSeed(seed)) {
      throw new TypeError(
        `A seed in "repeats.include" must be a string of 16 hexadecimal digits, received ${JSON.stringify(seed)}.`,
      )
    }
    const normalized = seed.toLowerCase()
    if (includeSeeds.includes(normalized)) {
      throw new TypeError(`"repeats.include" has the seed "${seed}" more than 1 time.`)
    }
    includeSeeds.push(normalized)
  }
  if (!includeSeeds.length) {
    return { repeats: count }
  }
  return { repeats: count + includeSeeds.length, includeSeeds }
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
  // the key of the test is its seed, unless the attempt has a seed from `repeats` or `--replay-seed`
  return (attempt.builtin ??= createRandomSource(attempt.seed ?? getTaskKey(test, seed)))
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
