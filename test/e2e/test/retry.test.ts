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
    retries: test.diagnostic().retryCount,
    repeats: test.diagnostic().repeatCount,
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

test.each([0, 1, 2])('expected failures exhaust retries when assertions pass (repeats: %i)', async (repeats) => {
  const { errorTree, results } = await runInlineTests({
    'fails.test.js': `
      import { expect, it } from 'vitest'

      it.fails('unexpected pass', { retry: 2, repeats: ${repeats} }, () => {
        expect(1).toBe(1)
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "fails.test.js": {
        "unexpected pass": [
          "Expect test to fail",
        ],
      },
    }
  `)
  const [test] = results[0].children.allTests()
  expect(test.diagnostic().retryCount).toBe(2 * (repeats + 1))
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
  expect(test.diagnostic().retryCount).toBe(2)
  expect(test.diagnostic().repeatCount).toBe(1)
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
