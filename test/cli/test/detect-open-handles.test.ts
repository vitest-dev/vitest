import { expect, test } from 'vitest'
import { runInlineTests as base } from '../../test-utils'

test('should not log anything unexpected { isolate: %s }', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leaking timeout', () => {
        setTimeout(() => {}, 100_000)
      })
    `,
  })

  console.log(stderr)

  expect(stdout).toContain('Leaks  1 leak')

  expect(stderr).toContain('Async leaks 1')
  expect(stderr).toMatch('Timeout  packages/example/test/example.test.ts')
})

function runInlineTests(...params: Parameters<typeof base>) {
  return base(params[0], { globals: true, detectAsyncLeaks: true, ...params[1] }, params[2])
}
