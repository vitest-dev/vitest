import type { Test } from '../types'

let _test: Test | undefined

export function setCurrentTest(test: Test | undefined) {
  _test = test
}

export function getCurrentTest() {
  return _test
}
