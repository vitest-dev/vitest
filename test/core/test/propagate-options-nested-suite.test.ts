import { describe, expect, it } from 'vitest'

describe(
  'suite name',
  () => {
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
  },
  { retry: 10 },
)
