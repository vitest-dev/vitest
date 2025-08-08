import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Limit concurrency to prevent resource exhaustion
    // This ensures only 2 service connections happen simultaneously
    maxConcurrency: 2,
    sequence: {
      hooks: 'parallel', // Test that parallel hooks respect maxConcurrency
    },
  },
})