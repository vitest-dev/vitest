// CI failes only for this file, but it works locally

import * as chai from 'chai'
import './setup'
import type { TaskPopulated, Test } from '@vitest/runner'
import { getCurrentTest } from '@vitest/runner'
import { ASYMMETRIC_MATCHERS_OBJECT, GLOBAL_EXPECT, addCustomEqualityTesters, getState, setState } from '@vitest/expect'
import type { Assertion, ExpectStatic } from '@vitest/expect'
import { getSafeTimers } from '@vitest/utils'
import type { MatcherState } from '../../types/chai'
import { getTestName } from '../../utils/tasks'
import { getCurrentEnvironment, getWorkerState } from '../../utils/global'

export function createExpect(test?: TaskPopulated) {
  const expect = ((value: any, message?: string): Assertion => {
    const { assertionCalls } = getState(expect)
    setState({ assertionCalls: assertionCalls + 1 }, expect)
    const assert = chai.expect(value, message) as unknown as Assertion
    const _test = test || getCurrentTest()
    if (_test)
      // @ts-expect-error internal
      return assert.withTest(_test) as Assertion
    else
      return assert
  }) as ExpectStatic
  Object.assign(expect, chai.expect)
  Object.assign(expect, (globalThis as any)[ASYMMETRIC_MATCHERS_OBJECT])

  expect.getState = () => getState<MatcherState>(expect)
  expect.setState = state => setState(state as Partial<MatcherState>, expect)

  // @ts-expect-error global is not typed
  const globalState = getState(globalThis[GLOBAL_EXPECT]) || {}

  const testPath = getTestFile(test)
  setState<MatcherState>({
    // this should also add "snapshotState" that is added conditionally
    ...globalState,
    assertionCalls: 0,
    isExpectingAssertions: false,
    isExpectingAssertionsError: null,
    expectedAssertionsNumber: null,
    expectedAssertionsNumberErrorGen: null,
    environment: getCurrentEnvironment(),
    testPath,
    currentTestName: test ? getTestName(test as Test) : globalState.currentTestName,
  }, expect)

  // @ts-expect-error untyped
  expect.extend = matchers => chai.expect.extend(expect, matchers)
  expect.addEqualityTesters = customTesters =>
    addCustomEqualityTesters(customTesters)

  expect.soft = (...args) => {
    // @ts-expect-error private soft access
    return expect(...args).withContext({ soft: true }) as Assertion
  }

  expect.poll = function poll(fn, options = {}): any {
    const { interval = 50, timeout = 1000, message } = options
    const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')
    // @ts-expect-error private poll access
    const assertion = expect(null, message).withContext({ poll: true }) as Assertion
    const proxy: any = new Proxy(assertion, {
      get(target, key, receiver) {
        const result = Reflect.get(target, key, receiver)

        if (typeof result !== 'function')
          return result instanceof chai.Assertion ? proxy : result

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

  expect.unreachable = (message?: string) => {
    chai.assert.fail(`expected${message ? ` "${message}" ` : ' '}not to be reached`)
  }

  function assertions(expected: number) {
    const errorGen = () => new Error(`expected number of assertions to be ${expected}, but got ${expect.getState().assertionCalls}`)
    if (Error.captureStackTrace)
      Error.captureStackTrace(errorGen(), assertions)

    expect.setState({
      expectedAssertionsNumber: expected,
      expectedAssertionsNumberErrorGen: errorGen,
    })
  }

  function hasAssertions() {
    const error = new Error('expected any number of assertion, but got none')
    if (Error.captureStackTrace)
      Error.captureStackTrace(error, hasAssertions)

    expect.setState({
      isExpectingAssertions: true,
      isExpectingAssertionsError: error,
    })
  }

  chai.util.addMethod(expect, 'assertions', assertions)
  chai.util.addMethod(expect, 'hasAssertions', hasAssertions)

  return expect
}

function copyStackTrace(target: Error, source: Error) {
  if (source.stack !== undefined)
    target.stack = source.stack.replace(source.message, target.message)
  return target
}

function getTestFile(test?: TaskPopulated) {
  if (test)
    return test.file.filepath
  const state = getWorkerState()
  return state.filepath
}

const globalExpect = createExpect()

Object.defineProperty(globalThis, GLOBAL_EXPECT, {
  value: globalExpect,
  writable: true,
  configurable: true,
})

export { assert, should } from 'chai'
export { chai, globalExpect as expect }
