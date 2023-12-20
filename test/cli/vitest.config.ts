import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['test/**.test.ts'],
    reporters: ['verbose'],
    testTimeout: 60_000,
    chaiConfig: {
      truncateThreshold: 999,
    },
  },
})
