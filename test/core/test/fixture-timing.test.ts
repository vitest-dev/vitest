import { describe, expect, test } from 'vitest'

// Simulate expensive worker-scoped fixture setup
const myTest = test.extend<{ warmup: { setupTime: number } }>({
  warmup: [
    async ({ }, use) => {
      const start = Date.now()
      // Simulate expensive operation (e.g., starting database)
      await new Promise(resolve => setTimeout(resolve, 2000))
      const setupTime = Date.now() - start
      await use({ setupTime })
    },
    { scope: 'worker', auto: true },
  ],
})

describe('fixture timing test', () => {
  myTest('first test', ({ warmup }) => {
    expect(warmup.setupTime).toBeGreaterThan(1900) // Should be ~2000ms
    expect(1 + 1).toBe(2)
  })

  myTest('second test', () => {
    expect(2 + 2).toBe(4)
  })

  myTest('third test', () => {
    expect(3 + 3).toBe(6)
  })
})
