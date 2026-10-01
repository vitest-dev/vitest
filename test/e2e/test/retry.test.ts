import { describe, expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

function run(testNamePattern: string) {
  return runVitest({
    include: ['fixtures/retry/retry.test.ts'],
    config: 'fixtures/retry/vitest.config.ts',
    testNamePattern,
  })
}

describe('retry', () => {
  test('should passed', async () => {
    const { stdout } = await run('should passed')

    expect(stdout).toContain('1 passed')
  })

  test('retry but still failed', async () => {
    const { stdout } = await run('retry but still failed')

    expect(stdout).toContain('expected 1 to be 4')
    expect(stdout).toContain('expected 2 to be 4')
    expect(stdout).toContain('expected 3 to be 4')
    expect(stdout).toContain('1 failed')
  })
})

test('expected failures stop retrying after a failed assertion', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'fails.test.js': `
      import { afterAll, expect, it } from 'vitest'

      const runs = {
        immediate: 0,
        passesThenFails: 0,
        repeats: [0, 0, 0],
      }

      it.fails('fails immediately', { retry: 2 }, () => {
        runs.immediate++
        expect(1).toBe(2)
      })

      it.fails('passes then fails', { retry: 2 }, () => {
        runs.passesThenFails++
        expect(runs.passesThenFails).toBe(1)
      })

      it.fails('repeats', { retry: 2, repeats: 2 }, ({ task }) => {
        runs.repeats[task.result.repeatCount]++
        expect(1).toBe(2)
      })

      afterAll(() => {
        expect(runs).toEqual({
          immediate: 1,
          passesThenFails: 2,
          repeats: [1, 1, 1],
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "fails.test.js": {
        "fails immediately": "passed",
        "passes then fails": "passed",
        "repeats": "passed",
      },
    }
  `)
})

test('expected failures exhaust retries in every repeat when assertions pass', async () => {
  const { errorTree } = await runInlineTests({
    'fails.test.js': `
      import { afterAll, expect, it } from 'vitest'

      const runs = [[0], [0, 0], [0, 0, 0]]

      for (const repeats of [0, 1, 2]) {
        it.fails('unexpected pass with ' + repeats + ' repeats', { retry: 2, repeats }, ({ task }) => {
          runs[repeats][task.result.repeatCount]++
          expect(1).toBe(1)
        })
      }

      afterAll(() => {
        expect(runs).toEqual([
          [3],
          [3, 3],
          [3, 3, 3],
        ])
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "fails.test.js": {
        "unexpected pass with 0 repeats": [
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
        ],
        "unexpected pass with 1 repeats": [
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
        ],
        "unexpected pass with 2 repeats": [
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
        ],
      },
    }
  `)
})

test('expected failures can recover through a retry in every repeat', async () => {
  const { stderr, errorTree, results } = await runInlineTests({
    'repeats.test.js': `
      import { afterAll, expect, it } from 'vitest'

      const attempts = [0, 0, 0]
      it.fails('recovers', { repeats: 2, retry: 2 }, ({ task }) => {
        const attempt = attempts[task.result.repeatCount]++
        if (attempt > 0) {
          throw new Error('attempt failed')
        }
      })

      afterAll(() => {
        expect(attempts).toEqual([2, 2, 2])
      })
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "repeats.test.js": {
        "recovers": "passed",
      },
    }
  `)

  const [test] = results[0].children.allTests()
  const attempts = test.attempts()
  expect(
    attempts.map((attempt) => ({
      state: attempt.state,
      errors: attempt.errors?.map((error) => error.message) || [],
      retryIndex: attempt.retryIndex,
      repeatIndex: attempt.repeatIndex,
    })),
  ).toMatchInlineSnapshot(`
    [
      {
        "errors": [
          "Expect test to fail",
        ],
        "repeatIndex": 0,
        "retryIndex": 0,
        "state": "failed",
      },
      {
        "errors": [],
        "repeatIndex": 0,
        "retryIndex": 1,
        "state": "passed",
      },
      {
        "errors": [
          "Expect test to fail",
        ],
        "repeatIndex": 1,
        "retryIndex": 0,
        "state": "failed",
      },
      {
        "errors": [],
        "repeatIndex": 1,
        "retryIndex": 1,
        "state": "passed",
      },
      {
        "errors": [
          "Expect test to fail",
        ],
        "repeatIndex": 2,
        "retryIndex": 0,
        "state": "failed",
      },
      {
        "errors": [],
        "repeatIndex": 2,
        "retryIndex": 1,
        "state": "passed",
      },
    ]
  `)
  attempts.forEach((attempt) => {
    expect(attempt.duration).toBeGreaterThanOrEqual(0)
    expect(attempt.startTime).toBeGreaterThan(0)
  })
})

test('attempts grow while the test runs', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'attempts.test.js': `
      import { afterAll, afterEach, expect, it } from 'vitest'

      const seen = []
      let runs = 0

      // the current attempt is recorded after afterEach, so only previous attempts are visible
      afterEach(({ task }) => {
        seen.push(task.result.attempts.map(({ repeatIndex, retryIndex, state }) => ({ repeatIndex, retryIndex, state })))
      })

      // |      repeat 0      |      repeat 1      |
      // | retry 0 -> retry 1 | retry 0 -> retry 1 |
      // |  fail   ->  pass   |  fail   ->  pass   |
      it('flaky', { retry: 1, repeats: 1 }, () => {
        expect(++runs % 2).toBe(0)
      })

      afterAll(() => {
        expect(seen).toEqual([
          [],
          [
            { repeatIndex: 0, retryIndex: 0, state: 'fail' },
          ],
          [
            { repeatIndex: 0, retryIndex: 0, state: 'fail' },
            { repeatIndex: 0, retryIndex: 1, state: 'pass' },
          ],
          [
            { repeatIndex: 0, retryIndex: 0, state: 'fail' },
            { repeatIndex: 0, retryIndex: 1, state: 'pass' },
            { repeatIndex: 1, retryIndex: 0, state: 'fail' },
          ],
        ])
      })
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "attempts.test.js": {
        "flaky": "passed",
      },
    }
  `)
})

test('skipping during a retry ends attempts with a skipped attempt', async () => {
  const { stderr, results } = await runInlineTests({
    'skip.test.js': `
      import { expect, it } from 'vitest'

      let runs = 0

      it('skips on retry', { retry: 2, repeats: 1 }, ({ skip }) => {
        if (++runs === 2) {
          skip()
        }
        expect(1).toBe(2)
      })

      it.skip('skipped statically', () => {})
    `,
  })

  expect(stderr).toBe('')
  const [skipsOnRetry, skippedStatically] = results[0].children.allTests()
  expect(skipsOnRetry.result().state).toBe('skipped')
  expect(
    skipsOnRetry
      .attempts()
      .map(({ repeatIndex, retryIndex, state }) => ({ repeatIndex, retryIndex, state })),
  ).toMatchInlineSnapshot(`
    [
      {
        "repeatIndex": 0,
        "retryIndex": 0,
        "state": "failed",
      },
      {
        "repeatIndex": 0,
        "retryIndex": 1,
        "state": "skipped",
      },
    ]
  `)
  expect(skippedStatically.attempts()).toEqual([])
})

test('syntax errors remain failures after successful repeats', async () => {
  const { errorTree } = await runInlineTests({
    'repeats.test.js': `
      import { afterAll, expect, it } from 'vitest'

      const runs = [0, 0]

      it.fails('syntax error', { repeats: 1, retry: 1 }, ({ task }) => {
        runs[task.result.repeatCount]++
        if (task.result.repeatCount === 0) {
          expect(1).toMatchInlineSnapshot('1')
        }
        expect(1).toBe(2)
      })

      afterAll(() => {
        expect(runs).toEqual([2, 1])
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "repeats.test.js": {
        "syntax error": [
          "'toMatchInlineSnapshot' cannot be used with 'test.fails'",
          "'toMatchInlineSnapshot' cannot be used with 'test.fails'",
        ],
      },
    }
  `)
})
