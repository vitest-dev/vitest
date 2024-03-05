import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    setupFiles: [
      './setup.ts',
    ],
    server: {
      deps: {
        external: [
          /packages\/web-worker/,
        ],
      },
    },
    onConsoleLog(log) {
      return !log.includes('Failed to load')
    },
  },
})
