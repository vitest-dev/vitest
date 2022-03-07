import chai from 'chai'
import { getState, setState } from './jest-expect'

export { assert, should } from 'chai'

export function createExpect() {
  const expect = ((value: any, message?: string): Vi.Assertion => {
    const { assertionCalls } = getState()
    setState({ assertionCalls: assertionCalls + 1 })
    return chai.expect(value, message) as unknown as Vi.Assertion
  }) as Vi.ExpectStatic
  Object.assign(expect, chai.expect)

  expect.getState = getState
  expect.setState = setState

  // @ts-expect-error untyped
  expect.extend = fn => chai.expect.extend(fn)

  return expect
}

const expect = createExpect()

export { chai, expect }
