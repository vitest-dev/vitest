import { expect, test, vi } from 'vitest'
import { runVitest } from '../../test-utils'

test('default intercept', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/console',
  })
  expect(stderr).toBe('stderr | basic.test.ts > basic\n__test_console__\n\n')
})

test.each(['threads', 'vmThreads'] as const)(`disable intercept pool=%s`, async (pool) => {
  // `disableConsoleIntercept: true` forwards workers console.error to main thread's stderr
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

  await runVitest({
    root: './fixtures/console',
    disableConsoleIntercept: true,
    pool,
  })

  const call = spy.mock.lastCall![0]
  expect(call.toString()).toBe('__test_console__\n')
})
