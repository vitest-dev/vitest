import { runVitest, StableTestFileOrderSorter } from '#test-utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { readCoverageMap } from '../../coverage-test/utils'

test('worker death on a shared runner does not skip coverage finalization', async () => {
  const root = './fixtures/pool-worker-exit'

  await runVitest({
    root,
    pool: 'forks',

    // Disable isolation to make sure crashed worker doesn't hang whole test run
    isolate: false,
    fileParallelism: false,

    // Run test in alphabetical order, crash worker mid-run
    sequence: { sequencer: StableTestFileOrderSorter },
    include: [
      '1-first.test.ts',

      /** Crashes worker, see @link {file://./../fixtures/pool-worker-exit/2-crash.test.ts} */
      '2-crash.test.ts',

      // Should not start as previous test crashed worker
      '3-second.test.ts',
    ],

    reporters: 'default',
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['json'],
      reportOnFailure: true,
    },
  })

  // Crashing worker should not interfere with other test-run, coverage should be reported:
  const coverageMap = await readCoverageMap(resolve(root, 'coverage/coverage-final.json'))
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/pool-worker-exit/src.ts')

  expect(fileCoverage.toSummary().functions).toMatchInlineSnapshot(`
    {
      "covered": 1,
      "pct": 50,
      "skipped": 0,
      "total": 2,
    }
  `)
})
