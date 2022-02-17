import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [
      './setup.ts'
    ],
    deps: {
      external: [
        /packages\/web-worker/
      ]
    }
  },
})
