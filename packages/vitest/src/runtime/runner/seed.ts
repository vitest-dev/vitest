import type { TestRandom } from '@vitest/utils/seed'
import type { File, Test, VitestRunner, WriteableTestContext } from './types'
import { createTestRandom, deriveSeed } from '@vitest/utils/seed'
import { getTests } from '../../utils/tasks'

const testSeeds = new WeakMap<Test, string>()
const attemptRandoms = new WeakMap<Test, TestRandom>()
const duplicateIndexes = new WeakMap<File, Map<Test, number>>()

export function defineRandomContext(
  context: WriteableTestContext,
  test: Test,
  runner: VitestRunner,
): void {
  Object.defineProperty(context, 'random', {
    configurable: true,
    get() {
      let random = attemptRandoms.get(test)
      if (!random) {
        random = createTestRandom(getTestSeed(test, runner))
        attemptRandoms.set(test, random)
      }
      return random
    },
    // a user fixture with the same name replaces the built-in value
    set(value: unknown) {
      Object.defineProperty(context, 'random', {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
      })
    },
  })
}

export function startSeedAttempt(test: Test): void {
  attemptRandoms.delete(test)
}

export function getAttemptSeed(test: Test): string | undefined {
  return attemptRandoms.get(test)?.seed
}

function getTestSeed(test: Test, runner: VitestRunner): string {
  let seed = testSeeds.get(test)
  if (seed == null) {
    seed = deriveSeed([
      String(runner.config.seed),
      test.file.projectName ?? '',
      test.file.name,
      test.fullTestName,
      String(getDuplicateIndex(test)),
      // the index of the seed within the test
      '0',
    ])
    testSeeds.set(test, seed)
  }
  return seed
}

// tests with the same full name in one file need different seeds
function getDuplicateIndex(test: Test): number {
  let indexes = duplicateIndexes.get(test.file)
  if (!indexes) {
    indexes = new Map()
    const counts = new Map<string, number>()
    for (const fileTest of getTests(test.file)) {
      const count = counts.get(fileTest.fullTestName) ?? 0
      counts.set(fileTest.fullTestName, count + 1)
      indexes.set(fileTest, count)
    }
    duplicateIndexes.set(test.file, indexes)
  }
  return indexes.get(test) ?? 0
}
