import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['./check-coverage.test.ts'],
  },
})
