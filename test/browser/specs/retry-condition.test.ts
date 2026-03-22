import { expect, test } from 'vitest'
import { runInlineBrowserTests } from './utils'

test('test.retry.condition is corrrectly serialized', async () => {
  const { stderr, results } = await runInlineBrowserTests({
    'basic.test.js': /* js */`
      import { expect, test } from 'vitest'

      test('task.retry.condition is corrrectly deserialized', ({ task }) => {
        expect(task.retry.condition).toBeInstanceOf(RegExp)
        expect(task.retry.condition).toStrictEqual(/retry_this/)
      })
    `,
  }, {
    retry: {
      condition: /retry_this/,
    },
  })
  expect(stderr).toBe('')
  for (const result of results) {
    expect(result.state()).toBe('passed')
  }
})
