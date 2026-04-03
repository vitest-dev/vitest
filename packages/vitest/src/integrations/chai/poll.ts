import type { Assertion, ExpectStatic } from '@vitest/expect'
import type { Test } from '@vitest/runner'
import { chai } from '@vitest/expect'
import { delay, getSafeTimers } from '@vitest/utils/timers'
import { getWorkerState } from '../../runtime/utils'
import { vi } from '../vi'

// these matchers are not supported because they don't make sense with poll
const unsupported = [
  // .poll is meant to retry matchers until they succeed, and
  // snapshots will always succeed as long as the poll method doesn't throw an error
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

/**
 * Attaches a `cause` property to the error if missing, copies the stack trace from the source, and throws.
 *
 * @param error - The error to throw
 * @param source - Error to copy the stack trace from
 *
 * @throws Always throws the provided error with an amended stack trace
 */
function throwWithCause(error: any, source: Error) {
  if (error.cause == null) {
    error.cause = new Error('Matcher did not succeed in time.')
  }

  throw copyStackTrace(
    error,
    source,
  )
}

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
    // injected so that domain snapshot can take over poll implementation.
    chai.util.flag(assertion, '_poll.fn', fn)
    chai.util.flag(assertion, '_poll.timeout', timeout)
    chai.util.flag(assertion, '_poll.interval', interval)
    const test = chai.util.flag(assertion, 'vitest-test') as Test | undefined
    if (!test) {
      throw new Error('expect.poll() must be called inside a test')
    }
    const proxy: any = new Proxy(assertion, {
      get(target, key, receiver) {
        const assertionFunction = Reflect.get(target, key, receiver)

        // We use `matcher.__vitest_poll_takeover__` flag
        // to let domain snapshot matchers take over polling logic.
        // this is not public API yet.
        // Need to use `getOwnPropertyDescriptor` since otherwise chai proxy breaks.
        const pollTakeover = Object.getOwnPropertyDescriptor(
          assertionFunction,
          '__vitest_poll_takeover__',
        )?.value

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

        // Core poll stack-trace trick:
        //   1. capture STACK_TRACE_ERROR here before entering the async poll loop
        //   2. when the matcher eventually fails, rethrow via throwWithCause()
        //      so the final error keeps this earlier stack
        //
        // For example, when user writes:
        //    await expect.poll(...).toBeSomething()
        // STACK_TRACE_ERROR.stack would look like
        //   at ...(more internal stacks)...
        //   at __VITEST_POLL_CHAIN__ .../packages/vitest/dist/...
        //   at .../my-file.test.ts:12:3   (this points to `toBeSomething()` callsite in user test file)
        // Vitest later filters out internal stacks from `vitest/dist`, so the reported errors correctly
        // points to the user callsite for poll assertion errors.
        //
        // Inline snapshots piggyback on the same idea. We pass
        // STACK_TRACE_ERROR through `chai.util.flag(assertion, 'error', ...)`.
        // Inline snapshot assertion access the same error stack for
        // extracting inline snapshot location to validate and update new snapshots.
        return function __VITEST_POLL_CHAIN__(this: any, ...args: any[]) {
          const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')
          const promise = async () => {
            chai.util.flag(assertion, '_name', key)
            chai.util.flag(assertion, 'error', STACK_TRACE_ERROR)

            const onSettled = chai.util.flag(assertion, '_poll.onSettled') as Function | undefined

            // Some snapshot-style custom matchers own polling logic for now.
            // This should be consolidated with the main poll loop later.
            if (pollTakeover) {
              try {
                const output = await assertionFunction.call(assertion, ...args)
                await onSettled?.({ assertion, status: 'pass' })
                return output
              }
              catch (err) {
                await onSettled?.({ assertion, status: 'fail' })
                throwWithCause(err, STACK_TRACE_ERROR)
              }
            }

            const { setTimeout, clearTimeout } = getSafeTimers()

            let executionPhase: 'fn' | 'assertion' = 'fn'
            let hasTimedOut = false

            const timerId = setTimeout(() => {
              hasTimedOut = true
            }, timeout)

            try {
              while (true) {
                const isLastAttempt = hasTimedOut

                if (isLastAttempt) {
                  chai.util.flag(assertion, '_isLastPollAttempt', true)
                }

                try {
                  executionPhase = 'fn'
                  const obj = await fn()
                  chai.util.flag(assertion, 'object', obj)

                  executionPhase = 'assertion'
                  const output = await assertionFunction.call(assertion, ...args)
                  await onSettled?.({ assertion, status: 'pass' })

                  return output
                }
                catch (err) {
                  if (isLastAttempt || (executionPhase === 'assertion' && chai.util.flag(assertion, '_poll.assert_once'))) {
                    await onSettled?.({ assertion, status: 'fail' })
                    throwWithCause(err, STACK_TRACE_ERROR)
                  }

                  await delay(interval, setTimeout)
                  if (vi.isFakeTimers()) {
                    vi.advanceTimersByTime(interval)
                  }
                }
              }
            }
            finally {
              clearTimeout(timerId)
            }
          }
          let awaited = false
          test.onFinished ??= []
          test.onFinished.push(() => {
            if (!awaited) {
              const negated = chai.util.flag(assertion, 'negate') ? 'not.' : ''
              const name = chai.util.flag(assertion, '_poll.element') ? 'element(locator)' : 'poll(assertion)'
              const assertionString = `expect.${name}.${negated}${String(key)}()`
              const error = new Error(
                `${assertionString} was not awaited. This assertion is asynchronous and must be awaited; otherwise, it is not executed to avoid unhandled rejections:\n\nawait ${assertionString}\n`,
              )
              throw copyStackTrace(error, STACK_TRACE_ERROR)
            }
          })
          let resultPromise: Promise<void> | undefined
          // only .then is enough to check awaited, but we type this as `Promise<void>` in global types
          // so let's follow it
          return {
            then(onFulfilled, onRejected) {
              awaited = true
              return (resultPromise ||= promise()).then(onFulfilled, onRejected)
            },
            catch(onRejected) {
              awaited = true
              return (resultPromise ||= promise()).catch(onRejected)
            },
            finally(onFinally) {
              awaited = true
              return (resultPromise ||= promise()).finally(onFinally)
            },
            [Symbol.toStringTag]: 'Promise',
          } satisfies Promise<void>
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
