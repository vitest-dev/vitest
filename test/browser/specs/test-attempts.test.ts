import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

test('reports every attempt through onTestCaseAttempt', async () => {
  const events: string[] = []

  const { stderr } = await runInlineBrowserTests(
    {
      'basic.test.ts': `
        import { expect, test } from 'vitest'

        let runs = 0
        test('flaky', { retry: 1, repeats: 1 }, () => {
          expect(++runs % 2).toBe(0)
        })
      `,
    },
    {
      browser: {
        instances: [instances[0]],
      },
      reporters: [
        {
          onTestCaseAttempt(testCase, attempt) {
            events.push(
              `attempt |${testCase.name}| [repeat ${attempt.repeatIndex}, retry ${attempt.retryIndex}, ${attempt.state}, attempts() ${testCase.attempts().length}]`,
            )
          },
          onTestCaseResult(testCase) {
            events.push(`result |${testCase.name}| ${testCase.result().state}`)
          },
        },
      ],
    },
  )

  expect(stderr).toBe('')
  expect(events).toMatchInlineSnapshot(`
    [
      "attempt |flaky| [repeat 0, retry 0, failed, attempts() 1]",
      "attempt |flaky| [repeat 0, retry 1, passed, attempts() 2]",
      "attempt |flaky| [repeat 1, retry 0, failed, attempts() 3]",
      "attempt |flaky| [repeat 1, retry 1, passed, attempts() 4]",
      "result |flaky| passed",
    ]
  `)
})
