import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/fixtures/**'],
    },
  },
  test: {
    reporters: 'verbose',
    include: ['test/**/*.test.*'],
    pool: 'forks',
    chaiConfig: {
      truncateThreshold: 0,
    },

    // For Windows CI mostly
    testTimeout: process.env.CI ? 60_000 : 10_000,

    // Test cases may have side effects, e.g. files under fixtures/ are modified on the fly to trigger file watchers
    fileParallelism: false,

    // TODO: Fix flakiness and remove
    allowOnly: true,
    bail: 1,
  },
})
