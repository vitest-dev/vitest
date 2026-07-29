import { describe, expect, it } from 'vitest'

describe('suite name', { retry: 9 }, () => {
  let outerCount = 0

  it('should retry until success', () => {
    outerCount++
    expect(outerCount).toBe(5)
  })

  describe('nested', () => {
    let innerCount = 0

    it('should retry until success (nested)', () => {
      innerCount++
      expect(innerCount).toBe(5)
    })
  })
})
