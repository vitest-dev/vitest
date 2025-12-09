import { assert, describe, expect, it } from 'vitest'
import { getSetupStates } from '../src/setups.ts'

describe('suite name', () => {
  it('foo', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('setups work', () => {
    expect(getSetupStates()).toEqual({
      jsSetup: true,
      tsSetup: true,
    })
  })

  it('snapshot', () => {
    expect({ foo: 'bar' }).toMatchSnapshot()
  })

  it('inline snapshot', () => {
    expect({ foo: 'bar' }).toMatchInlineSnapshot(`
      {
        "foo": "bar",
      }
    `)
  })
})
