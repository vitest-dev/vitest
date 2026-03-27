import { fileURLToPath } from 'node:url'
import type { TestSpecification } from 'vitest/node'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  optimizeDeps: {
    include: ['@vitest/cjs-lib'],
    needsInterop: ['@vitest/cjs-lib'],
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  resolve: {
    alias: {
      '~/': new URL('./src/', import.meta.url).pathname,
    },
  },
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
    },
    sequence: {
      sequencer: class {
        sort(specifications: TestSpecification[]) {
          return specifications.sort((left, right) => left.moduleId.localeCompare(right.moduleId))
        }

        shard(specifications: TestSpecification[]) {
          return specifications
        }
      },
    },
  },
})
