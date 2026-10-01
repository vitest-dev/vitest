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
  const { stderr, errorTree } = await runInlineTests({
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
