import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**.test.ts'],
    reporters: ['verbose'],
    testTimeout: 60_000,
    chaiConfig: {
      truncateThreshold: 999,
    },
  },
})
