import type { TestSpecification } from 'vitest/node'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: {
    fileParallelism: false,
    sequence: {
      sequencer: class {
        async shard(files: TestSpecification[]) {
          return files
        }
        async sort(files: TestSpecification[]) {
          return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
        }
      },
    },
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
    },
  },
})
