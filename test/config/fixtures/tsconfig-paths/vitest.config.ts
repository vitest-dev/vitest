import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    extensions: ['.custom.ts', '.ts', '.js'],
    dedupe: ['vitest'],
    alias: {
      '#': '/src',
      '@': '/lib',
    },
  },
  test: {
    include: ['**/*.test.ts'],
  },
})
