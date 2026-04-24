import { describe, expect, it } from 'vitest'

describe('MyModule', () => {
  describe('feature A', () => {
    it('works correctly', () => {
      expect(1 + 1).toBe(2)
    })
    it('handles edge case', () => {
      expect(0).toBe(0)
    })
  })
  it('top-level in describe', () => {
    expect(true).toBe(true)
  })
})

it('top-level test', () => {
  expect('hello').toBe('hello')
})
