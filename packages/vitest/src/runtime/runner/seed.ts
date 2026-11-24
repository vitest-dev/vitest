import type { RandomSource } from '@vitest/utils/random-source'
import type { SerializedConfig } from '../config'
import type { RandomExample } from './example'
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
import { ordinal } from '@vitest/utils/helpers'
import {
  createRandomSource,
  deriveSeed,
  getRandomStates,
  isSeed,
  setRandomExample,
  trackRandomStates,
} from '@vitest/utils/random-source'
import { decodeRandomTape, RandomTape } from '@vitest/utils/random-tape'
import { shortenTape } from '../../utils/random'
import { getExampleItems } from './example'

interface AttemptRandom {
  seed?: string
  tape?: RandomTape
  // a tape without a record that counts the reads of each fork
  countsReads?: boolean
  example?: RandomExample
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
// the keys without the run seed, so that an example gets the same values on every run
const stableTaskKeys = new WeakMap<Task, string>()
// the examples are not on the task, because the task is sent to the main process and an example
// can hold any value
const testExamples = new WeakMap<Test, Record<string, unknown>[]>()
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

// with a tape, the attempt records its random values or reads them from the tape
export function startSeedAttempt(
  test: Test,
  seed: string | undefined,
  tape?: RandomTape,
  example?: RandomExample,
  countsReads?: boolean,
): void {
  attemptRandoms.set(test, { seed, tape, example, countsReads })
}

// The values of `random` and of a `now` range are inputs of the test. The fakes of `Math.random`
// and `crypto` read from `vitest:globals`, and a test can use them only to get stable values.
export function readsAttemptInput(test: Test): boolean {
  const paths = attemptRandoms.get(test)?.tape?.getReadPaths() ?? []
  return paths.some((path) => path[0] !== 'vitest:globals' || path[1] === 'vitest:clock')
}

// each seed of `repeats` and `seeds` gives other fake values, so they are inputs too
export function hasSeededRepeats(test: Test): boolean {
  return (test.repeats ?? 0) > (testExamples.get(test)?.length ?? 0)
}

export function createRepeatsResult(
  test: Test,
  config: SerializedConfig,
): TaskResultRepeats | undefined {
  if (!test.repeats || config.replaySeed) {
    return undefined
  }
  return {
    // the key of the test, so the first repeat after `seeds` has the values of the test without `repeats`
    base: getTaskKey(test, config.seed),
    examples: testExamples.get(test)?.length ?? 0,
    seeds: test.seeds ?? [],
    startTimes: [],
    durations: [],
    seeded: [],
  }
}

// each seed adds 1 run before the repeats
export function resolveTestSeeds(
  repeats: TestOptions['repeats'],
  seeds: TestOptions['seeds'],
): {
  repeats: number | undefined
  seeds?: string[]
  tapes?: (string | undefined)[]
} {
  if (
    repeats != null &&
    (typeof repeats !== 'number' || !Number.isInteger(repeats) || repeats < 0)
  ) {
    throw new TypeError(
      `The "repeats" option must be an integer of 0 or more, received ${typeof repeats === 'number' ? repeats : JSON.stringify(repeats)}.`,
    )
  }
  if (seeds == null) {
    return { repeats }
  }
  if (!Array.isArray(seeds)) {
    throw new TypeError(
      `The "seeds" option must be an array of seeds, received ${JSON.stringify(seeds)}.`,
    )
  }
  const normalizedSeeds: string[] = []
  const tapes: (string | undefined)[] = []
  for (const entry of seeds) {
    // seed hex digits and base64url tapes have no `:`
    const separator = typeof entry === 'string' ? entry.indexOf(':') : -1
    const seed = separator === -1 ? entry : entry.slice(0, separator)
    // a pasted tape can end with a line break
    const tape = separator === -1 ? undefined : entry.slice(separator + 1).trim()
    if (!isSeed(seed)) {
      throw new TypeError(
        `A seed in "seeds" must be a string of 16 hexadecimal digits, received ${JSON.stringify(typeof entry === 'string' ? shortenTape(entry) : entry)}.`,
      )
    }
    if (tape !== undefined && !decodeRandomTape(tape)) {
      throw new TypeError(
        `The tape of the seed "${seed}" in "seeds" is not valid. Copy the entry from the "Keep" line of a failed test.`,
      )
    }
    const normalized = seed.toLowerCase()
    if (normalizedSeeds.includes(normalized)) {
      throw new TypeError(`"seeds" has the seed "${seed}" more than 1 time.`)
    }
    normalizedSeeds.push(normalized)
    tapes.push(tape)
  }
  if (!normalizedSeeds.length) {
    return { repeats }
  }
  return {
    repeats: (repeats ?? 0) + normalizedSeeds.length,
    seeds: normalizedSeeds,
    tapes: tapes.some((tape) => tape !== undefined) ? tapes : undefined,
  }
}

// each example adds 1 run before the seeds
export function resolveTestExamples(
  examples: TestOptions['examples'],
): Record<string, unknown>[] | undefined {
  if (examples == null) {
    return undefined
  }
  if (!Array.isArray(examples)) {
    throw new TypeError(`The "examples" option must be an array, received ${typeof examples}.`)
  }
  for (const [index, example] of examples.entries()) {
    if (typeof example !== 'object' || example === null || Array.isArray(example)) {
      throw new TypeError(
        `The ${ordinal(index + 1)} example must be an object with the labels of random.span() and random.many() as keys.`,
      )
    }
    // the keys of forks are checked when a fork reads them
    for (const key of Object.keys(example)) {
      if (key.startsWith('$')) {
        getExampleItems(example, key.slice(1), [], `The ${ordinal(index + 1)} example`)
      }
    }
  }
  return examples.length ? examples : undefined
}

export function setTestExamples(test: Test, examples: Record<string, unknown>[]): void {
  testExamples.set(test, examples)
}

export function getTestExamples(test: Test): Record<string, unknown>[] | undefined {
  return testExamples.get(test)
}

// all values outside of the example come from this seed, so an example runs the same input on
// every run
export function getExampleSeed(test: Test, index: number): string {
  return deriveSeed(['example', getTaskKey(test, '', stableTaskKeys), String(index)])
}

// a key that no call used is a mistake in the example, for example an old label
export function getUnusedExampleError(test: Test, index: number): Error | undefined {
  const example = attemptRandoms.get(test)?.example
  const unused = example?.getUnusedKeys()
  if (!example || !unused?.length) {
    return undefined
  }
  const keys = unused.map((key) => JSON.stringify(key)).join(', ')
  const paths = example.getCallPaths()
  const calls = paths.length
    ? `The run called random.span() or random.many() with ${paths.map((path) => JSON.stringify(path)).join(', ')}.`
    : 'The run did not call random.span() or random.many().'
  const error = new Error(
    `The ${ordinal(index + 1)} example has ${unused.length === 1 ? 'a key' : 'keys'} that no call used: ${keys}. ${calls}`,
  )
  // the location is in Vitest, not in the test
  error.stack = `${error.name}: ${error.message}`
  return error
}

export function resolveTestShrink(option: TestOptions['shrink']): boolean | number | undefined {
  if (option == null || typeof option === 'boolean') {
    return option
  }
  if (typeof option !== 'number' || !Number.isFinite(option) || option <= 0) {
    throw new TypeError(
      `The "shrink" option expects a boolean or a time limit in milliseconds, received ${JSON.stringify(option)}.`,
    )
  }
  return option
}

export function getAttemptSeed(test: Test): string | undefined {
  return attemptRandoms.get(test)?.builtin?.seed
}

// the state of `random` and of its forks at the end of the attempt
export function getAttemptRandomStates(test: Test): Map<string, string> {
  const builtin = attemptRandoms.get(test)?.builtin
  return builtin ? getRandomStates(builtin) : new Map()
}

// the test keeps the random source of its last attempt, but not the forks
export function releaseAttemptRandomStates(test: Test): void {
  const builtin = attemptRandoms.get(test)?.builtin
  if (builtin) {
    trackRandomStates(builtin, false)
  }
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
  // the key of the test is its seed, unless the attempt has a seed from `repeats`, `seeds` or `--replay-seed`
  if (!attempt.builtin) {
    const key = attempt.seed ?? getTaskKey(test, seed)
    if (!attempt.tape && attempt.countsReads) {
      attempt.tape = new RandomTape({ record: false })
    }
    attempt.builtin = attempt.tape ? attempt.tape.createSource(key) : createRandomSource(key)
    if (attempt.example) {
      setRandomExample(attempt.builtin, attempt.example)
    }
    // the replay of a failed seed compares the states of all forks with the failed run
    trackRandomStates(attempt.builtin)
  }
  return attempt.builtin
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
function getTaskKey(task: Task, seed: string, keys = taskKeys): string {
  let key = keys.get(task)
  if (key == null) {
    const parent = task.suite ?? (task.file === task ? undefined : task.file)
    key = parent
      ? deriveSeed([
          task.type,
          getTaskKey(parent, seed, keys),
          task.name,
          String(duplicateIndexes.get(task) ?? 0),
        ])
      : deriveSeed(['file', seed, task.file.projectName ?? '', task.file.name])
    keys.set(task, key)
  }
  return key
}
