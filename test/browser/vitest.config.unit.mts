import type { TestSpecification } from 'vitest/node'
import { defineConfig } from 'vitest/config'
import { BaseSequencer } from 'vitest/node'

export default defineConfig({
  test: {
    include: ['specs/**/*.{spec,test}.ts'],
    pool: 'threads',
    fileParallelism: false,
    reporters: 'verbose',
    setupFiles: ['./setup.unit.ts'],
    // 3 is the maximum of browser instances - in a perfect world they will run in parallel
    hookTimeout: process.env.CI ? 120_000 * 3 : 20_000,
    testTimeout: process.env.CI ? 120_000 * 3 : 20_000,
    sequence: {
      // Extend BaseSequencer so `--shard` works (its deterministic hash split),
      // keeping a stable name-based sort. Sharding splits the specs across CI
      // runners while each spec still runs across every browser instance.
      sequencer: class Sequencer extends BaseSequencer {
        async sort(specifications: TestSpecification[]) {
          return specifications.sort((spec1, spec2) => {
            // just sort by name, ignore the cache optimization
            return spec1.moduleId.localeCompare(spec2.moduleId)
          })
        }
      },
    },
  },
})
