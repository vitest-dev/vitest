import { runInlineTests } from '#test-utils'
import { expect, it } from 'vitest'

it('test.retry.condition is corrrectly serialized', async () => {
  const { stderr, results } = await runInlineTests({
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
  expect(results).toHaveLength(1)
  expect(results[0].state()).toBe('passed')
})
