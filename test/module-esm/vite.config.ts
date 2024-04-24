import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        external: [/css-what/, /prototype\.mjs/],
      },
    },
  },
})
