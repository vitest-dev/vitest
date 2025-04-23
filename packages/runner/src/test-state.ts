import type { Test } from './types/tasks.ts'

let _test: Test | undefined

export function setCurrentTest<T extends Test>(test: T | undefined): void {
  _test = test
}

export function getCurrentTest<T extends Test | undefined>(): T {
  return _test as T
}

const tests: Array<Test> = []
export function addRunningTest(test: Test): () => void {
  const index = tests.push(test)
  return () => {
    tests.splice(index)
  }
}

export function getRunningTests(): Array<Test> {
  return tests
}
