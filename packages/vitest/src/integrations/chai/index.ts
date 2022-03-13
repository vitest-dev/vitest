import chai from 'chai'
import './setup'
import { getState, setState } from './jest-expect'

const expect = ((value: any, message?: string): Vi.Assertion => {
  const { assertionCalls } = getState()
  setState({ assertionCalls: assertionCalls + 1 })
  return chai.expect(value, message) as unknown as Vi.Assertion
}) as Vi.ExpectStatic

Object.assign(expect, chai.expect)

expect.getState = getState
expect.setState = setState
// @ts-expect-error untyped
expect.extend = matchers => chai.expect.extend(expect, matchers)

export { assert, should } from 'chai'
export { chai, expect }
