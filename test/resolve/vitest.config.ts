import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['**/web.test.ts', 'happy-dom'],
      ['**/ssr.test.ts', 'node'],
    ],
    server: {
      deps: {
        external: [/pkg-/],
      },
    },
  },
})
