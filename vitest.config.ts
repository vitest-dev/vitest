import { defineConfig } from './src'

export default defineConfig({
  test: {
    includes: ['test/**/*.test.ts'],
    excludes: ['**/node_modules/**', '**/fixtures/**'],
  },
})
