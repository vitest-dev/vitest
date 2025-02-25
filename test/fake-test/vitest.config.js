import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    files: ['test/**/*.test.ts'],

  },
})
