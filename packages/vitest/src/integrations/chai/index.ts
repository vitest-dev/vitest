import chai from 'chai'
import { getState, setState } from './jest-expect'

export { assert, should } from 'chai'

const expect = (value: any, message?: string): Chai.Assertion =>  {
  const { assertionCalls } = getState()
  setState({ assertionCalls: assertionCalls + 1 })
  return chai.expect(value, message)
}

Object.assign(expect, chai.expect)

export { chai, expect }
