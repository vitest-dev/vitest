import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    deps: {
      external: [/tslib/, /css-what/, /prototype\.mjs/],
    },
  },
})
