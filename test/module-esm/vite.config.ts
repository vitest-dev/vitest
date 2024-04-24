import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        external: [/tslib/, /css-what/, /prototype\.mjs/],
      },
    },
  },
})
