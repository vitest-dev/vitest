import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    testTimeout: process.env.CI ? 120_000 : 5_000,
  },
})
