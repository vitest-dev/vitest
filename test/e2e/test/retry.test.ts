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
  const { stderr, errorTree, results } = await runInlineTests({
    'fails.test.js': `
      import { expect, it } from 'vitest'

      it.fails('fails immediately', { retry: 2 }, () => {
        expect(1).toBe(2)
      })

      it.fails('passes then fails', { retry: 2 }, ({ task }) => {
        expect(task.result.retryCount).toBe(0)
      })

      it.fails('repeats', { retry: 2, repeats: 2 }, () => {
        expect(1).toBe(2)
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
  expect([...results[0].children.allTests()].map(test => ({
    name: test.name,
    retries: test.diagnostic()!.retryCount,
    repeats: test.diagnostic()!.repeatCount,
  }))).toMatchInlineSnapshot(`
    [
      {
        "name": "fails immediately",
        "repeats": 0,
        "retries": 0,
      },
      {
        "name": "passes then fails",
        "repeats": 0,
        "retries": 1,
      },
      {
        "name": "repeats",
        "repeats": 2,
        "retries": 0,
      },
    ]
  `)
})

test('expected failures exhaust retries in every repeat when assertions pass', async () => {
  const { errorTree, results } = await runInlineTests({
    'fails.test.js': `
      import { expect, it } from 'vitest'

      for (const repeats of [0, 1, 2]) {
        it.fails('unexpected pass with ' + repeats + ' repeats', { retry: 2, repeats }, () => {
          expect(1).toBe(1)
        })
      }
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "fails.test.js": {
        "unexpected pass with 0 repeats": [
          "Expect test to fail",
        ],
        "unexpected pass with 1 repeats": [
          "Expect test to fail",
          "Expect test to fail",
        ],
        "unexpected pass with 2 repeats": [
          "Expect test to fail",
          "Expect test to fail",
          "Expect test to fail",
        ],
      },
    }
  `)
  expect([...results[0].children.allTests()].map(test => ({
    name: test.name,
    retries: test.diagnostic()!.retryCount,
  }))).toMatchInlineSnapshot(`
    [
      {
        "name": "unexpected pass with 0 repeats",
        "retries": 2,
      },
      {
        "name": "unexpected pass with 1 repeats",
        "retries": 4,
      },
      {
        "name": "unexpected pass with 2 repeats",
        "retries": 6,
      },
    ]
  `)
})

test('expected failures retain a failed repeat after a successful repeat', async () => {
  const { errorTree, results } = await runInlineTests({
    'fails.test.js': `
      import { expect, it } from 'vitest'

      it.fails('fails first repeat', { retry: 2, repeats: 1 }, ({ task }) => {
        expect(task.result.repeatCount).toBe(0)
      })
    `,
  })

  const [test] = results[0].children.allTests()
  expect(test.diagnostic()!.retryCount).toBe(2)
  expect(test.diagnostic()!.repeatCount).toBe(1)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "fails.test.js": {
        "fails first repeat": [
          "Expect test to fail",
        ],
      },
    }
  `)
})

test('ordinary and expected failures both retain failed repeats without retries', async () => {
  const { errorTree } = await runInlineTests({
    'repeats.test.js': `
      import { expect, it } from 'vitest'

      it('ordinary', { repeats: 1 }, ({ task }) => {
        if (task.result.repeatCount === 0) {
          throw new Error('first repeat failed')
        }
      })

      it.fails('expected failure', { repeats: 1 }, ({ task }) => {
        expect(task.result.repeatCount).toBe(0)
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "repeats.test.js": {
        "expected failure": [
          "Expect test to fail",
        ],
        "ordinary": [
          "first repeat failed",
        ],
      },
    }
  `)
})

test.each([false, true])('each repeat can recover through a retry (fails: %s)', async (fails) => {
  const { stderr, errorTree, results } = await runInlineTests({
    'repeats.test.js': `
      import { afterAll, expect, it } from 'vitest'

      const attempts = [0, 0, 0]
      it('recovers', { fails: ${fails}, repeats: 2, retry: 2 }, ({ task }) => {
        const attempt = attempts[task.result.repeatCount]++
        if (${fails} ? attempt > 0 : attempt === 0) {
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
  expect(test.diagnostic()!.retryCount).toBe(3)
  expect(test.diagnostic()!.repeatCount).toBe(2)
})

test('syntax errors remain failures after successful repeats', async () => {
  const { errorTree, results } = await runInlineTests({
    'repeats.test.js': `
      import { expect, it } from 'vitest'

      it.fails('syntax error', { repeats: 1, retry: 1 }, ({ task }) => {
        if (task.result.repeatCount === 0) {
          expect(1).toMatchInlineSnapshot('1')
        }
        expect(1).toBe(2)
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
  const [test] = results[0].children.allTests()
  expect(test.diagnostic()!.retryCount).toBe(1)
  expect(test.diagnostic()!.repeatCount).toBe(1)
})
