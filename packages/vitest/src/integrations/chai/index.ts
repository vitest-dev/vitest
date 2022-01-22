import chai from 'chai'
import { getState, setState } from './jest-expect'

export { assert, should } from 'chai'

const expect = ((value: any, message?: string): Vi.Assertion => {
  const { assertionCalls } = getState()
  setState({ assertionCalls: assertionCalls + 1 })
  return chai.expect(value, message) as unknown as Vi.Assertion
}) as Vi.ExpectStatic
expect.getState = getState
expect.setState = setState

Object.assign(expect, chai.expect)

export { chai, expect }
