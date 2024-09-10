import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['specs/**/*.{spec,test}.ts'],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    hookTimeout: process.env.CI ? 120_000 : 20_000,
    testTimeout: process.env.CI ? 120_000 : 20_000,
  },
})
