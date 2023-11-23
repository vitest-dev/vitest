import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: 'verbose',
    include: ['test/**/*.test.*'],
    chaiConfig: {
      truncateThreshold: 0,
    },

    // For Windows CI mostly
    testTimeout: process.env.CI ? 60_000 : 10_000,

    // Test cases may have side effects, e.g. files under fixtures/ are modified on the fly to trigger file watchers
    poolOptions: {
      threads: { singleThread: true },
      vmThreads: { singleThread: true },
    },

    // TODO: Fix flakiness and remove
    allowOnly: true,
  },
})
