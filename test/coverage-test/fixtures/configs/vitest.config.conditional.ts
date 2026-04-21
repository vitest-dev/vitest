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
            if (this.environment.config.consumer === 'server') {
              return resolve('fixtures/src/conditional/ssr.ts')
            }
            return resolve('fixtures/src/conditional/web.ts')
          }
        }
      },
    }
  ]
})
