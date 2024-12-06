import type { Test } from '@vitest/runner/types'
import type { Assertion } from './types'
import { processError } from '@vitest/utils/error'

export function createAssertionMessage(
  util: Chai.ChaiUtils,
  assertion: Assertion,
  hasArgs: boolean,
) {
  const not = util.flag(assertion, 'negate') ? 'not.' : ''
  const name = `${util.flag(assertion, '_name')}(${hasArgs ? 'expected' : ''})`
  const promiseName = util.flag(assertion, 'promise')
  const promise = promiseName ? `.${promiseName}` : ''
  return `expect(actual)${promise}.${not}${name}`
}

export function recordAsyncExpect(
  _test: any,
  promise: Promise<any>,
  assertion: string,
  error: Error,
) {
  const test = _test as Test | undefined
  // record promise for test, that resolves before test ends
  if (test && promise instanceof Promise) {
    // if promise is explicitly awaited, remove it from the list
    promise = promise.finally(() => {
      if (!test.promises) {
        return
      }
      const index = test.promises.indexOf(promise)
      if (index !== -1) {
        test.promises.splice(index, 1)
      }
    })

    // record promise
    if (!test.promises) {
      test.promises = []
    }
    test.promises.push(promise)

    let resolved = false
    test.onFinished ??= []
    test.onFinished.push(() => {
      if (!resolved) {
        const processor = (globalThis as any).__vitest_worker__?.onFilterStackTrace || ((s: string) => s || '')
        const stack = processor(error.stack)
        console.warn([
          `Promise returned by \`${assertion}\` was not awaited. `,
          'Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. ',
          'Please remember to await the assertion.\n',
          stack,
        ].join(''))
      }
    })

    return {
      then(onFulfilled, onRejected) {
        resolved = true
        return promise.then(onFulfilled, onRejected)
      },
      catch(onRejected) {
        return promise.catch(onRejected)
      },
      finally(onFinally) {
        return promise.finally(onFinally)
      },
      [Symbol.toStringTag]: 'Promise',
    } satisfies Promise<any>
  }

  return promise
}

export function wrapAssertion(
  utils: Chai.ChaiUtils,
  name: string,
  fn: (this: Chai.AssertionStatic & Assertion, ...args: any[]) => void,
) {
  return function (this: Chai.AssertionStatic & Assertion, ...args: any[]) {
    // private
    if (name !== 'withTest') {
      utils.flag(this, '_name', name)
    }

    if (!utils.flag(this, 'soft')) {
      return fn.apply(this, args)
    }

    const test: Test = utils.flag(this, 'vitest-test')

    if (!test) {
      throw new Error('expect.soft() can only be used inside a test')
    }

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
