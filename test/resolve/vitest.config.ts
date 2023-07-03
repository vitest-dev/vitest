import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    server: {
      transformMode: {
        web: [/web\.test\.ts/],
        ssr: [/ssr\.test\.ts/],
      },
      deps: {
        external: [/pkg-/],
      },
    },
  },
})
