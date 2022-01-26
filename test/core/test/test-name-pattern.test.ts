import { assert, describe, it } from 'vitest'

it('does include root test', () => {
  assert.equal(Math.sqrt(4), 2)
})

it('does not include test that is root and unmatched', () => {
  assert.fail('unmatched test was included')
})

describe('testNamePattern', () => {
  it('does include test in describe', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('does not include test that is in describe and unmatched', () => {
    assert.fail('unmatched test was included')
  })

  describe('nested describe', () => {
    it('does include nested test', () => {
      assert.equal(Math.sqrt(4), 2)
    })

    it('does not include test that is nested and unmatched', () => {
      assert.fail('unmatched test was included')
    })
  })
})
