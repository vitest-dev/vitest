import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: 'verbose',
    include: ['test/**/*.test.*'],

    // For Windows CI mostly
    testTimeout: 30_000,

    // Test cases may have side effects, e.g. files under fixtures/ are modified on the fly to trigger file watchers
    singleThread: true,
  },
})
