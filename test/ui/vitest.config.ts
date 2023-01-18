import { defineConfig } from 'vitest/config'

const timeout = process.env.CI ? 50000 : 30000

export default defineConfig({
  test: {
    setupFiles: ['./setup.ts'],
    globalSetup: ['./globalSetup.ts'],
    exclude: ['node_modules', 'fixtures', 'dist'],
    testTimeout: timeout,
    hookTimeout: timeout,
  },
})
