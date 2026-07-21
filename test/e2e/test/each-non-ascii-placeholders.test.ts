import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test('formatting of non-ascii placeholders in test.each', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test.each\`
        时间戳 | 结果
        \${1}  | \${5}
        \${2}  | \${10}
      \`('returns $结果 given $时间戳', ({ 结果, 时间戳 }) => {
        expect(结果).toBeGreaterThan(时间戳)
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  expect(stderr).toBe('')
  expect(ctx?.state.getTestModules()[0].children.array()).toStrictEqual(
    [
      expect.objectContaining({ name: 'returns 5 given 1' }),
      expect.objectContaining({ name: 'returns 10 given 2' }),
    ],
  )
})
