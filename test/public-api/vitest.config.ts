import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    chaiConfig: {
      truncateThreshold: 0,
    },
  },
})
