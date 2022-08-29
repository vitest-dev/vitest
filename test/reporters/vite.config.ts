import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    exclude: ['fixtures/*.test.ts'],
    testTimeout: 100000,
  },

})
