import { assert, describe, expect, it, vi } from 'vitest'

describe('suite name', () => {
  it('foo', () => {
    vi.resetModules()
    // a comment here
    // another comment
    // another comment
    // another comment
    // another comment
    // another comment
    // this will mess up the stacktrace lines
    expect(1 + 1).eq(2)
    expect(2 + 1).eq(3)
    assert.equal(Math.sqrt(4), 2)
    expect(Math.sqrt(4)).toBe(1)
  })
})
