import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: [
      './coverage-test/*.c8.test.ts',
    ],
  },
})
