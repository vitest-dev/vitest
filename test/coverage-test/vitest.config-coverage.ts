import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: [
      './coverage-test/*.test.ts',
    ],
  },
})
