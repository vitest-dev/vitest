import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        autoUpdate: true,

        // Global ones
        lines: 0.1,
        functions: 0.2,
        branches: 0.3,
        statements: 0.4,

        '**/src/math.ts': {
          branches: 0.1,
          functions: 0.2,
          lines: 0.3,
          statements: 0.4
        }
      }
    }
  },
})
