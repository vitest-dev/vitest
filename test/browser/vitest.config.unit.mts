import type { TestSpecification } from 'vitest/node'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['specs/**/*.{spec,test}.ts'],
    pool: 'threads',
    fileParallelism: false,
    reporters: 'verbose',
    setupFiles: ['./setup.unit.ts'],
    // 3 is the maximum of browser instances - in a perfect world they will run in parallel
    // Windows runners (esp. webkit) cold-start much slower than mac/linux, bump cap.
    hookTimeout: process.env.CI ? 120_000 * (process.platform === 'win32' ? 5 : 3) : 20_000,
    testTimeout: process.env.CI ? 120_000 * (process.platform === 'win32' ? 5 : 3) : 20_000,
    sequence: {
      sequencer: class Sequencer {
        sort(specifications: TestSpecification[]) {
          return specifications.sort((spec1, spec2) => {
            // just sort by name, ignore the cache optimization
            return spec1.moduleId.localeCompare(spec2.moduleId)
          })
        }

        shard(): TestSpecification[] {
          throw new Error('not supported')
        }
      },
    },
  },
})
