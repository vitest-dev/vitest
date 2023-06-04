import { GLOBAL_EXPECT } from './constants'
import { getState } from './state'
import type { Assertion, MatcherState } from './types'

export function recordAsyncExpect(test: any, promise: Promise<any> | PromiseLike<any>) {
  // record promise for test, that resolves before test ends
  if (test && promise instanceof Promise) {
    // if promise is explicitly awaited, remove it from the list
    promise = promise.finally(() => {
      const index = test.promises.indexOf(promise)
      if (index !== -1)
        test.promises.splice(index, 1)
    })

    // record promise
    if (!test.promises)
      test.promises = []
    test.promises.push(promise)
  }

  return promise
}

export function wrapSoft(utils: Chai.ChaiUtils, fn: (this: Chai.AssertionStatic & Assertion, ...args: any[]) => void) {
  return function (this: Chai.AssertionStatic & Assertion, ...args: any[]) {
    const test = utils.flag(this, 'vitest-test')

    const state: MatcherState = test?.context._local
      ? test.context.expect.getState()
      : getState((globalThis as any)[GLOBAL_EXPECT])

    if (!state.soft)
      return fn.apply(this, args)

    try {
      return fn.apply(this, args)
    }
    catch (err) {
      test.result.state = 'fail'
      test.result.errors ||= []
      test.result.errors.push(err)
    }
  }
}
