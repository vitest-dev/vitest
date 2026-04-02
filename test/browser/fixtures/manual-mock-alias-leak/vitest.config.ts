import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${new URL('src/', import.meta.url).pathname}`,
    },
  },
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
    },
    fileParallelism: false,
    maxWorkers: 1,
    include: ['src/**/*.spec.ts'],
  },
})
