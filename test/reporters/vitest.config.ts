import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['node_modules', 'fixtures', 'dist'],
    reporters: ['verbose'],
    testTimeout: 100000,
    pool: 'forks',
    chaiConfig: {
      truncateThreshold: 0,
    },
    typecheck: {
      enabled: true,
      include: ['./tests/configuration-options.test-d.ts'],
    },
  },
})
