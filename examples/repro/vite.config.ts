import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'text-summary', 'html', 'clover', 'json'],
    },
  },
})
