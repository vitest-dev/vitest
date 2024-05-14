import * as chai from 'chai'
import type { ExpectStatic } from '@vitest/expect'
import { getSafeTimers } from '@vitest/utils'

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
    const { interval = 50, timeout = 1000, message } = options
    const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')
    // @ts-expect-error private poll access
    const assertion = expect(null, message).withContext({ poll: true }) as Assertion
    const proxy: any = new Proxy(assertion, {
      get(target, key, receiver) {
        const result = Reflect.get(target, key, receiver)

        if (typeof result !== 'function')
          return result instanceof chai.Assertion ? proxy : result

        if (typeof key === 'string' && unsupported.includes(key))
          throw new SyntaxError(`expect.poll() is not supported in combination with .${key}(). Use vi.waitFor() if your assertion condition is unstable.`)

        return function (this: any, ...args: any[]) {
          return new Promise((resolve, reject) => {
            let intervalId: any
            let lastError: any
            const { setTimeout } = getSafeTimers()
            setTimeout(() => {
              clearTimeout(intervalId)
              reject(copyStackTrace(new Error(`Matcher did not succeed in ${timeout}ms`, { cause: lastError }), STACK_TRACE_ERROR))
            }, timeout)
            const check = async () => {
              try {
                chai.util.flag(this, 'object', await fn())
                resolve(await result.call(this, ...args))
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
  if (source.stack !== undefined)
    target.stack = source.stack.replace(source.message, target.message)
  return target
}
