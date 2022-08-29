import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    exclude: ['fixtures/*.test.ts', '**/node_modules/**'],
    testTimeout: 100000,
  },
})
