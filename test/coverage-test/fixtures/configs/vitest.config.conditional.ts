import { join, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /fixtures\/src\/conditional/,
        replacement: "$1",
        customResolver(_, __, options) {
          if ('ssr' in options && options.ssr) {
            return { id: resolve('fixtures/src/conditional/node.ts') }
          }
          return { id: resolve('fixtures/src/conditional/browser.ts') }
        },
      },
    ],
  },
})
