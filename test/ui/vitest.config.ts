import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./setup.ts'],
    globalSetup: ['./globalSetup.ts'],
    exclude: ['node_modules', 'fixtures', 'dist'],
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
})
