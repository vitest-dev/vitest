import type { Custom, Test } from './types'

let _test: Test | Custom | undefined

export function setCurrentTest<T extends Test | Custom>(test: T | undefined) {
  _test = test
}

export function getCurrentTest<T extends Test | Custom | undefined>(): T {
  return _test as T
}
