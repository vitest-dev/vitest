import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    maxConcurrency: 2,
    reporters: ['verbose'],
  },
})