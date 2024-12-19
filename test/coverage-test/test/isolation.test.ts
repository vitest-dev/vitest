import type { TestSpecification } from 'vitest/node'
import { expect, test } from 'vitest'
import { readCoverageMap, runVitest } from '../utils'

const pools = ['forks']

if (!process.env.COVERAGE_BROWSER) {
  pools.push('threads')

  const [major] = process.version.slice(1).split('.').map(num => Number(num))

  if (major < 22) {
    pools.push('vmForks', 'vmThreads')
  }
}

for (const isolate of [true, false]) {
  for (const pool of pools) {
    test(`{ isolate: ${isolate}, pool: "${pool}" }`, async () => {
      await runVitest({
        include: ['fixtures/test/isolation-*'],
        setupFiles: ['fixtures/setup.isolation.ts'],
        sequence: { sequencer: Sorter },

        pool,
        isolate,
        fileParallelism: false,

        coverage: {
          all: false,
          reporter: ['json', 'html'],
        },

        browser: {
          isolate,
        },
      })

      const coverageMap = await readCoverageMap()

      const branches = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/branch.ts')
      expect(branches.toSummary().lines.pct).toBe(100)
      expect(branches.toSummary().statements.pct).toBe(100)
      expect(branches.toSummary().functions.pct).toBe(100)
      expect(branches.toSummary().branches.pct).toBe(100)

      const math = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/math.ts')
      expect(math.toSummary().lines.pct).toBe(100)
      expect(math.toSummary().statements.pct).toBe(100)
      expect(math.toSummary().functions.pct).toBe(100)
      expect(math.toSummary().branches.pct).toBe(100)
    })
  }
}

class Sorter {
  sort(files: TestSpecification[]) {
    return files.sort((a) => {
      if (a.moduleId.includes('isolation-1')) {
        return -1
      }
      return 1
    })
  }

  shard(files: TestSpecification[]) {
    return files
  }
}
