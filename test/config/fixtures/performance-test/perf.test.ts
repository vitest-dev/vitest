import { beforeAll, describe, it, expect } from 'vitest'

// Create many suites with hooks to test performance
describe.concurrent('Performance Test', () => {
  // Generate 5 suites with hooks (reduced further for reliable testing)
  describe.for(Array.from({ length: 5 }, (_, i) => i))('Suite %d', (index) => {
    beforeAll(async () => {
      // Simulate work - reduced to 30ms for faster execution
      await new Promise(r => setTimeout(r, 30))
    })

    // Single test per suite for faster execution
    it(`test ${index}`, () => {
      expect(true).toBe(true)
    })
  })
})