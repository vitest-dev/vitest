import type { RunVitestConfig } from '#test-utils'
import { runInlineTests } from '#test-utils'
import { playwright } from '@vitest/browser-playwright'
import { expect, it } from 'vitest'

function modeToConfig(mode: string): RunVitestConfig {
  if (mode === 'playwright') {
    return {
      browser: {
        enabled: true,
        headless: true,
        screenshotFailures: false,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    }
  }
  return {}
}

it.for(['node', 'playwright'])('test.retry.condition is corrrectly serialized %s', async (mode) => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.js': /* js */`
      import { expect, test } from 'vitest'

      test('task.retry.condition is corrrectly deserialized', ({ task }) => {
        expect(task.retry.condition).toBeInstanceOf(RegExp)
        expect(task.retry.condition).toStrictEqual(/retry_this/)
      })

      let trial = 0;
      test('retry', () => {
        trial++
        if (trial === 1) {
          throw new Error('retry_this')
        }
      })

      let trial2 = 0;
      test('not retry', () => {
        trial2++
        if (trial2 === 1) {
          throw new Error('retry_that')
        }
      })
    `,
  }, {
    ...modeToConfig(mode),
    retry: {
      count: 1,
      condition: /retry_this/,
    },
  })
  if (mode === 'playwright') {
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  |chromium| basic.test.js > not retry
      Error: retry_that
       ❯ basic.test.js:21:17
           19|         trial2++
           20|         if (trial2 === 1) {
           21|           throw new Error('retry_that')
             |                 ^
           22|         }
           23|       })

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  }
  else {
    expect(stderr).toMatchInlineSnapshot(`
      "
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

       FAIL  basic.test.js > not retry
      Error: retry_that
       ❯ basic.test.js:21:17
           19|         trial2++
           20|         if (trial2 === 1) {
           21|           throw new Error('retry_that')
             |                 ^
           22|         }
           23|       })

      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

      "
    `)
  }
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "not retry": [
          "retry_that",
        ],
        "retry": "passed",
        "task.retry.condition is corrrectly deserialized": "passed",
      },
    }
  `)
})
