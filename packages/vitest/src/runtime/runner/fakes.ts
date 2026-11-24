import type { Suite, Test, TestOptions } from './types'

export interface TestFakes {
  random?: boolean
}

// the options are not on the task, because the task is sent to the main process
const testFakes = new WeakMap<Test, TestFakes>()

export function getTestFakes(test: Test): TestFakes | undefined {
  return testFakes.get(test)
}

const restores = new WeakMap<Test, () => void>()

// the runner that installs the fakes of an attempt gives the function that removes them
export function setTestFakesRestore(test: Test, restore: () => void): void {
  restores.set(test, restore)
}

export function restoreTestFakes(test: Test): void {
  const restore = restores.get(test)
  restores.delete(test)
  restore?.()
}

export function setTestFakes(test: Test, options: TestOptions): void {
  const { fakeRandom } = options
  if (fakeRandom != null && typeof fakeRandom !== 'boolean') {
    throw new TypeError(
      `The "fakeRandom" option of a test must be a boolean, received ${JSON.stringify(fakeRandom)}.`,
    )
  }
  if (fakeRandom && isConcurrent(test)) {
    throw new Error(
      `The "fakeRandom" option cannot be used in the concurrent test "${test.fullTestName}", because tests that run at the same time share the random functions. Use \`context.random\` instead, or set \`concurrent: false\` on the test and on its suites.`,
    )
  }
  if (fakeRandom != null) {
    testFakes.set(test, { random: fakeRandom })
  }
}

// a concurrent suite runs at the same time as the suites next to it, also if the test is not concurrent
function isConcurrent(test: Test): boolean {
  if (test.concurrent) {
    return true
  }
  let suite: Suite | undefined = test.suite
  while (suite) {
    if (suite.concurrent) {
      return true
    }
    suite = suite.suite
  }
  return false
}
