import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['node_modules', 'fixtures', 'dist'],
    testTimeout: 100000,
    chaiConfig: {
      truncateThreshold: 9999,
    },
  },
})
