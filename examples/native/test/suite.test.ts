import { assert, describe, expect, it } from 'vitest'
import { getSetupStates, initJsSetup, initTsSetup } from '../src/setups.ts'

describe('suite name', () => {
  it('foo', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('setups work', () => {
    expect(initJsSetup).toHaveBeenCalled()
    expect(initTsSetup).toHaveBeenCalled()

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
