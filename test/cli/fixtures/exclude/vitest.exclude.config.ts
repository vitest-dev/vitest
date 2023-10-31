import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    exclude: ['fixtures/exclude/string.test.ts'],
  },
})
