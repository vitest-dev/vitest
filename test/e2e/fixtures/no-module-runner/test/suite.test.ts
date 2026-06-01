import { assert, describe, expect, it } from 'vitest'
import { getSetupStates, initJsSetup, initTsSetup } from '../src/setups.ts'

describe('suite name', () => {
  it('foo', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('setups work', () => {
    // TODO: a separate CLI test that confirms --maxWorkers=1 --no-isolate runs the setup file for every test file
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
