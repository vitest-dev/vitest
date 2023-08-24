import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['test/*.test.ts'],
    chaiConfig: {
      truncateThreshold: 0,
    },
  },
})
