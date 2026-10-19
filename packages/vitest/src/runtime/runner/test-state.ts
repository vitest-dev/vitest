import type { Test } from './types'

let _test: Test | undefined

export function setCurrentTest<T extends Test>(test: T | undefined): void {
  _test = test
}

export function getCurrentTest<T extends Test | undefined>(): T {
  return _test as T
}

const tests = new Set<Test>()
export function addRunningTest(test: Test): () => void {
  tests.add(test)
  return () => {
    tests.delete(test)
  }
}

export function getRunningTests(): ReadonlySet<Test> {
  return tests
}
