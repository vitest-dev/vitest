import { describe, expect, it } from 'vitest'

describe('nested only behavior', () => {
  describe.only('describe.only with nested test.only', () => {
    it.only('should be the only test that runs', () => {
      expect(true).toBe(true)
    })

    it('should NOT run because the previous test has test.only', () => {
      throw new Error('This test should not run')
    })
  })

  describe('another suite', () => {
    it('should not run - outside describe.only', () => {
      throw new Error('This test should not run')
    })
  })
})
