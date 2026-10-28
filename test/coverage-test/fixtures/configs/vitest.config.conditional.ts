import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'test-resolve-conditional',
      resolveId: {
        order: 'pre',
        handler(source) {
          if (source.includes("fixtures/src/conditional")) {
            const params = source.split("?").pop()

            if (this.environment.config.consumer === 'server') {
              return resolve('fixtures/src/conditional/ssr.ts') + "?" + params
            }
            return resolve('fixtures/src/conditional/web.ts') + "?" + params
          }
        }
      },
    }
  ]
})
