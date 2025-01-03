import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        autoUpdate: true,

        // Global ones
        lines: 0.1,
        functions: 0.2,
        branches: -1000,
        statements: -2000,

        '**/src/math.ts': {
          branches: 0.1,
          functions: 0.2,
          lines: -1000,
          statements: -2000,
        }
      }
    }
  },
})
