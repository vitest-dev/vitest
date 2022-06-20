import chai, { util } from 'chai'
import './setup'
import type { Test } from '../../types'
import { getFullName } from '../../utils'
import type { MatcherState } from '../../types/chai'
import { getState, setState } from './jest-expect'
import { GLOBAL_EXPECT } from './constants'

export function createExpect(test?: Test) {
  const expect = ((value: any, message?: string): Vi.Assertion => {
    const { assertionCalls } = getState(expect)
    setState({ assertionCalls: assertionCalls + 1 }, expect)
    const assert = chai.expect(value, message) as unknown as Vi.Assertion
    if (test)
      // @ts-expect-error internal
      return assert.withTest(test) as Vi.Assertion
    else
      return assert
  }) as Vi.ExpectStatic
  Object.assign(expect, chai.expect)

  expect.getState = () => getState(expect)
  expect.setState = state => setState(state as Partial<MatcherState>, expect)

  setState({
    assertionCalls: 0,
    isExpectingAssertions: false,
    isExpectingAssertionsError: null,
    expectedAssertionsNumber: null,
    expectedAssertionsNumberErrorGen: null,
    testPath: test?.suite.file?.filepath,
    currentTestName: test ? getFullName(test) : undefined,
  }, expect)

  // @ts-expect-error untyped
  expect.extend = matchers => chai.expect.extend(expect, matchers)

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

  util.addMethod(expect, 'assertions', assertions)
  util.addMethod(expect, 'hasAssertions', hasAssertions)

  return expect
}

const globalExpect = createExpect()

Object.defineProperty(globalThis, GLOBAL_EXPECT, {
  value: globalExpect,
  writable: true,
  configurable: true,
})

export { assert, should } from 'chai'
export { chai, globalExpect as expect }
