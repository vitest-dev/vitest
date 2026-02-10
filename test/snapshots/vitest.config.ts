import { defineConfig } from 'vite'
import { defaultExclude } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...defaultExclude, '**/fixtures'],
    testTimeout: process.env.CI ? 60_000 : 5_000,
  },
})
