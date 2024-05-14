import { processError } from '@vitest/utils/error'
import type { Test } from '@vitest/runner/types'
import { GLOBAL_EXPECT, JEST_MATCHERS_OBJECT } from './constants'
import { getState } from './state'
import type { Assertion, ChaiPlugin, MatcherState } from './types'

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
    const test: Test = utils.flag(this, 'vitest-test')

    // @ts-expect-error local is untyped
    const state: MatcherState = test?.context._local
      ? test.context.expect.getState()
      : getState((globalThis as any)[GLOBAL_EXPECT])

    if (!state.soft)
      return fn.apply(this, args)

    if (!test)
      throw new Error('expect.soft() can only be used inside a test')

    try {
      return fn.apply(this, args)
    }
    catch (err) {
      test.result ||= { state: 'fail' }
      test.result.state = 'fail'
      test.result.errors ||= []
      test.result.errors.push(processError(err))
    }
  }
}

export function defineAssertion<T>(name: keyof Assertion, fn: (this: Omit<Chai.AssertionStatic & Assertion, '_obj'> & { _obj: T }, ...args: any) => any): ChaiPlugin {
  return (chai, utils) => {
    const addMethod = (n: keyof Assertion) => {
      const softWrapper = wrapSoft(utils, fn)
      utils.addMethod(chai.Assertion.prototype, n, softWrapper)
      utils.addMethod((globalThis as any)[JEST_MATCHERS_OBJECT].matchers, n, softWrapper)
    }

    if (Array.isArray(name))
      name.forEach(n => addMethod(n))
    else
      addMethod(name)
  }
}
