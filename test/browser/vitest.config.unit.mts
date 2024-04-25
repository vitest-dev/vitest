import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['specs/**/*.{spec,test}.ts'],
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    hookTimeout: process.env.CI ? 120_000 : 10_000,
    testTimeout: process.env.CI ? 120_000 : 10_000,
  },
})
