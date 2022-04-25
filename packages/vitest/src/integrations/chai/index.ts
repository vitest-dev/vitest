import chai from 'chai'
import './setup'
import type { Test } from '../../types'
import { getState, setState } from './jest-expect'

export function createExpect(test?: Test) {
  const expect = ((value: any, message?: string): Vi.Assertion => {
    const { assertionCalls } = getState()
    setState({ assertionCalls: assertionCalls + 1 })
    const assert = chai.expect(value, message) as unknown as Vi.Assertion
    if (test)
      // @ts-expect-error internal
      return assert.withTest(test) as Vi.Assertion
    else
      return assert
  }) as Vi.ExpectStatic
  Object.assign(expect, chai.expect)

  expect.getState = getState
  expect.setState = setState

  // @ts-expect-error untyped
  expect.extend = matchers => chai.expect.extend(expect, matchers)

  return expect
}

const expect = createExpect()

export { assert, should } from 'chai'
export { chai, expect }
