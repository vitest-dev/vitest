import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

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

test('errors from failed repeats are retained across successful repeats', async () => {
  const { errorTree, results } = await runInlineTests({
    'repeats.test.js': `
      import { it } from 'vitest'

      it('ordinary', { repeats: 2, retry: 1 }, ({ task }) => {
        if (task.result.repeatCount !== 1) {
          throw new Error('repeat ' + task.result.repeatCount + ' failed')
        }
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "repeats.test.js": {
        "ordinary": [
          "repeat 0 failed",
          "repeat 0 failed",
          "repeat 2 failed",
          "repeat 2 failed",
        ],
      },
    }
  `)
  const [test] = results[0].children.allTests()
  expect(test.diagnostic()!.retryCount).toBe(2)
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
