import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: 'verbose',
    include: ['test/**/*.test.*'],
    env: { CI: 'true' },

    // For Windows CI mostly
    testTimeout: process.env.CI ? 30_000 : 10_000,
    chaiConfig: {
      truncateThreshold: 999,
    },
  },
})
