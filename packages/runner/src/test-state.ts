import type { Test } from './types/tasks'

let _test: Test | undefined

export function setCurrentTest<T extends Test>(test: T | undefined): void {
  _test = test
}

export function getCurrentTest<T extends Test | undefined>(): T {
  return _test as T
}

const tests: Array<Test> = []
export function addRunningTest(test: Test): () => void {
  tests.push(test)
  return () => {
    tests.splice(tests.indexOf(test))
  }
}

export function getRunningTests(): Array<Test> {
  return tests
}
