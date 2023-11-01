import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['fixtures/exclude/*.test.ts'],
    exclude: ['fixtures/exclude/string.test.ts'],
  },
})
