import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['specs/**/*.{spec,test}.ts'],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    reporters: 'verbose',
    setupFiles: ['./setup.unit.ts'],
    // 3 is the maximum of browser instances - in a perfect world they will run in parallel
    hookTimeout: process.env.CI ? 120_000 * 3 : 20_000,
    testTimeout: process.env.CI ? 120_000 * 3 : 20_000,
  },
})
