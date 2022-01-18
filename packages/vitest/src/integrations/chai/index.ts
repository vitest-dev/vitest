import chai from 'chai'
import { getState, setState } from './jest-expect'

export { assert, should } from 'chai'

const expect = ((value: any, message?: string): Chai.VitestAssertion => {
  const { assertionCalls } = getState()
  setState({ assertionCalls: assertionCalls + 1 })
  return chai.expect(value, message)
}) as Chai.ExpectStatic
expect.getState = getState
expect.setState = setState

Object.assign(expect, chai.expect)

export { chai, expect }
