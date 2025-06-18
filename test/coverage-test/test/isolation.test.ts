import type { TestSpecification } from 'vitest/node'
import { expect, test } from 'vitest'
import { formatSummary, readCoverageMap, runVitest } from '../utils'

const pools = ['forks']

if (!process.env.COVERAGE_BROWSER) {
  pools.push('threads')
  pools.push('vmForks', 'vmThreads')
}

for (const isolate of [true, false]) {
  for (const pool of pools) {
    test(`{ isolate: ${isolate}, pool: "${pool}" }`, async () => {
      await runVitest({
        include: ['fixtures/test/isolation-*.test.ts'],
        setupFiles: ['fixtures/setup.isolation.ts'],
        sequence: { sequencer: Sorter },

        pool,
        isolate,
        fileParallelism: false,

        coverage: {
          reporter: 'json',
        },

        browser: {
          isolate,
        },
      })

      const coverageMap = await readCoverageMap()
      const branches = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/branch.ts')
      const math = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/math.ts')

      const summary = {
        [branches.path]: formatSummary(branches.toSummary()),
        [math.path]: formatSummary(math.toSummary()),
      }

      expect(summary).toStrictEqual({
        '<process-cwd>/fixtures/src/branch.ts': {
          branches: '2/2 (100%)',
          functions: '1/1 (100%)',
          lines: '4/4 (100%)',
          statements: '4/4 (100%)',
        },
        '<process-cwd>/fixtures/src/math.ts': {
          branches: '0/0 (100%)',
          functions: '4/4 (100%)',
          lines: '4/4 (100%)',
          statements: '4/4 (100%)',
        },
      })
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
