import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    maxConcurrency: Infinity,
    reporters: ['verbose'],
  },
})