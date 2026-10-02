import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// Regression for #11423.
//
// Under `isolate: false` a worker is reused across files. `test.env` is merged
// into `process.env` once, when the worker is spawned, so a file that assigns
// to one of those keys leaks that value into every later file in the same
// worker. Vitest 4 reapplied `test.env` before each file; 5.x did not, which
// regressed suites that point a configured key (for example a DATABASE_URL) at
// a throwaway resource per file and tear it down afterwards.
//
// `maxWorkers: 1` is required, not cosmetic. With more workers the pool splits
// the files across them so they never share one, the leak cannot happen, and
// this test would pass with the bug still present. With a single worker
// `groupSpecs` (packages/vitest/src/node/pool.ts) batches every file into one
// run request, which is the case that regressed.
//
// Each file reports its pid and the test asserts they match, so it fails loudly
// instead of silently going vacuous if scheduling ever changes.
const twoFiles = (key: string) => ({
  'a.test.js': `
    import { expect, test } from 'vitest'
    const seenOnEntry = process.env.${key}
    process.env.${key} = 'clobbered-by-a'
    test('a starts from the configured value', () => {
      expect(seenOnEntry).toBe('configured')
      console.log('SHARED_PID_A=' + process.pid)
    })
  `,
  'b.test.js': `
    import { expect, test } from 'vitest'
    const seenOnEntry = process.env.${key}
    test('b also starts from the configured value', () => {
      expect(seenOnEntry).toBe('configured')
      console.log('SHARED_PID_B=' + process.pid)
    })
  `,
})

test.for(['forks', 'threads'])(
  'isolate: false — %s: test.env is reapplied before every file in a reused worker',
  async (pool) => {
    const { stderr, stdout } = await runInlineTests(twoFiles('VITEST_REAPPLY_KEY'), {
      pool,
      isolate: false,
      maxWorkers: 1,
      env: { VITEST_REAPPLY_KEY: 'configured' },
    })

    // The two files must have shared one worker, otherwise this test proves
    // nothing. Assert that rather than trusting the config.
    const pidA = /SHARED_PID_A=(\d+)/.exec(stdout)?.[1]
    const pidB = /SHARED_PID_B=(\d+)/.exec(stdout)?.[1]
    expect(pidA, 'file a did not report a pid').toBeTruthy()
    expect(pidB, 'file b did not report a pid').toBeTruthy()
    expect(pidA, 'files did not share a worker, so the regression is not exercised').toBe(pidB)

    // Before the fix, b.test.js reads 'clobbered-by-a' and reports a failure.
    expect(stderr).toBe('')
  },
  60_000,
)

// A key that is NOT configured through `test.env` still leaks between files.
// That is the documented behaviour of `isolate: false` and must not change.
test('isolate: false still leaks keys that test.env does not configure', async () => {
  const { stderr } = await runInlineTests(
    {
      'a.test.js': `
        import { expect, test } from 'vitest'
        const seenOnEntry = process.env.VITEST_UNCONFIGURED_KEY
        process.env.VITEST_UNCONFIGURED_KEY = 'set-by-a'
        test('a sees nothing configured', () => {
          expect(seenOnEntry).toBeUndefined()
        })
      `,
      'b.test.js': `
        import { expect, test } from 'vitest'
        test('b observes the leak, which is expected', () => {
          expect(process.env.VITEST_UNCONFIGURED_KEY).toBe('set-by-a')
        })
      `,
    },
    {
      pool: 'forks',
      isolate: false,
      maxWorkers: 1,
      env: { VITEST_REAPPLY_KEY: 'configured' },
    },
  )

  expect(stderr).toBe('')
}, 60_000)
