import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    exclude: ['**/string.test.ts'],
  },
})
