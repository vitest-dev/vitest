import * as chai from 'chai'
import type { Assertion, ExpectStatic } from '@vitest/expect'
import { getSafeTimers } from '@vitest/utils'
import { getWorkerState } from '../../utils'

// these matchers are not supported because they don't make sense with poll
const unsupported = [
  // .poll is meant to retry matchers until they succeed, and
  // snapshots will always succeed as long as the poll method doesn't thow an error
  // in this case using the `vi.waitFor` method is more appropriate
  'matchSnapshot',
  'toMatchSnapshot',
  'toMatchInlineSnapshot',
  'toThrowErrorMatchingSnapshot',
  'toThrowErrorMatchingInlineSnapshot',
  // toThrow will never succeed because we call the poll callback until it doesn't throw
  'throws',
  'Throw',
  'throw',
  'toThrow',
  'toThrowError',
  // these are not supported because you can call them without `.poll`,
  // we throw an error inside the rejects/resolves methods to prevent this
  // rejects,
  // resolves
]

export function createExpectPoll(expect: ExpectStatic): ExpectStatic['poll'] {
  return function poll(fn, options = {}) {
    const state = getWorkerState()
    const defaults = state.config.expect?.poll ?? {}
    const {
      interval = defaults.interval ?? 50,
      timeout = defaults.timeout ?? 1000,
      message,
    } = options
    // @ts-expect-error private poll access
    const assertion = expect(null, message).withContext({
      poll: true,
    }) as Assertion
    fn = fn.bind(assertion)
    const proxy: any = new Proxy(assertion, {
      get(target, key, receiver) {
        const assertionFunction = Reflect.get(target, key, receiver)

        if (typeof assertionFunction !== 'function') {
          return assertionFunction instanceof chai.Assertion ? proxy : assertionFunction
        }

        if (key === 'assert') {
          return assertionFunction
        }

        if (typeof key === 'string' && unsupported.includes(key)) {
          throw new SyntaxError(
            `expect.poll() is not supported in combination with .${key}(). Use vi.waitFor() if your assertion condition is unstable.`,
          )
        }

        return function (this: any, ...args: any[]) {
          const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')
          return new Promise((resolve, reject) => {
            let intervalId: any
            let lastError: any
            const { setTimeout, clearTimeout } = getSafeTimers()
            const timeoutId = setTimeout(() => {
              clearTimeout(intervalId)
              reject(
                copyStackTrace(
                  new Error(`Matcher did not succeed in ${timeout}ms`, {
                    cause: lastError,
                  }),
                  STACK_TRACE_ERROR,
                ),
              )
            }, timeout)
            const check = async () => {
              try {
                chai.util.flag(assertion, '_name', key)
                const obj = await fn()
                chai.util.flag(assertion, 'object', obj)
                resolve(await assertionFunction.call(assertion, ...args))
                clearTimeout(intervalId)
                clearTimeout(timeoutId)
              }
              catch (err) {
                lastError = err
                intervalId = setTimeout(check, interval)
              }
            }
            check()
          })
        }
      },
    })
    return proxy
  }
}

function copyStackTrace(target: Error, source: Error) {
  if (source.stack !== undefined) {
    target.stack = source.stack.replace(source.message, target.message)
  }
  return target
}
