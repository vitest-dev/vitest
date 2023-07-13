import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['./test/**/*'],
    testTimeout: process.env.CI ? 30_000 : 10_000,
    chaiConfig: {
      truncateThreshold: 0,
    },
  },
})
