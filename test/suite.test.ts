import { expect, assert, describe } from '../src'

describe('suite name', (it) => {
  it('foo', () => {
    assert.equal(Math.sqrt(4), 2)
    assert.equal(Math.sqrt(144), 12)
    assert.equal(Math.sqrt(2), Math.SQRT2)
  })

  it('bar', () => {
    expect(1).eq(1)
  })
})
