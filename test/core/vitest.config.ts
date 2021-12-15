import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    testTimeout: 2000,
    // threads: false,
    setupFiles: [
      './test/setup.ts',
    ],
  },
})
