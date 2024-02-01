import { assert, describe, expect, it } from 'vitest'

describe('suite name', () => {
  it('foo', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('bar', () => {
    expect(1 + 1).eq(2)
  })

  it('snapshot', () => {
    expect({ foo: 'bar' }).toMatchSnapshot()
  })
})

describe.runIf(process.env.TEST_GH_REPORTER)('error', () => {
  it('stack', () => {
    boom()
  })

  it('diff', () => {
    expect({ hello: 'x' }).toEqual({ hello: 'y' })
  })
})

function boom() {
  boomInner1()
}

function boomInner1() {
  throw new Error('boom')
}
