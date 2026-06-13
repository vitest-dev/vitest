import { runVitest, StableTestFileOrderSorter } from '#test-utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { readCoverageMap } from '../../coverage-test/utils'

test('worker death on a shared runner does not skip coverage finalization', async () => {
  const root = './fixtures/pool-worker-exit'

  const { buildTree, stderr } = await runVitest({
    root,
    pool: 'forks',

    // Disable isolation to make sure crashed worker doesn't hang whole test run
    isolate: false,
    maxWorkers: 2,

    sequence: { sequencer: StableTestFileOrderSorter },
    include: [
      '1-first.test.ts',
      '2-crash.test.ts',
      '3-crash.test.ts',
      '4-third.test.ts',
    ],

    reporters: 'default',
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['json'],
      reportOnFailure: true,
    },
  })

  expect(buildTree(t => ({ state: t.result().state }))).toMatchInlineSnapshot(`
    {
      "1-first.test.ts": {
        "first test exercises src so it should appear in coverage": {
          "state": "passed",
        },
      },
      "2-crash.test.ts": {
        "the worker dies before sending testfileFinished": {
          "state": "pending",
        },
      },
      "3-crash.test.ts": {
        "the worker dies before sending testfileFinished": {
          "state": "pending",
        },
      },
      "4-third.test.ts": {
        "third test": {
          "state": "passed",
        },
      },
    }
  `)

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
  // should report two errors in stderr
  expect(stderr).toContain('caught 2 unhandled errors')
})

test('worker process exit and kill raises exit code and signal to stderr', async () => {
  const root = './fixtures/pool-worker-exit'

  const { buildTree, stderr } = await runVitest({
    root,
    pool: 'forks',

    // Disable isolation to make sure crashed worker doesn't hang whole test run
    isolate: false,
    maxWorkers: 2,

    sequence: { sequencer: StableTestFileOrderSorter },
    include: [
      '1-first.test.ts',
      '3-crash.test.ts',
      '4-third.test.ts',
      '5-exit.test.ts',
    ],

    reporters: 'default',
  })

  expect(buildTree(t => ({ state: t.result().state }))).toMatchInlineSnapshot(`
    {
      "1-first.test.ts": {
        "first test exercises src so it should appear in coverage": {
          "state": "passed",
        },
      },
      "3-crash.test.ts": {
        "the worker dies before sending testfileFinished": {
          "state": "pending",
        },
      },
      "4-third.test.ts": {
        "third test": {
          "state": "passed",
        },
      },
      "5-exit.test.ts": {
        "the worker exits before sending testfileFinished": {
          "state": "pending",
        },
      },
    }
  `)

  // should report one error in stderr
  expect(stderr).toContain('caught 2 unhandled errors')
  // should report the exit code (5-exit.test.ts exits its own process mid-way with code 42)
  expect(stderr).toContain('exited unexpectedly with exit code 42')
  // should report the signal (3-crash.test.ts kills itself with SIGINT)
  expect(stderr).toContain('exited unexpectedly with signal SIGINT')
})
