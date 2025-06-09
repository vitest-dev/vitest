import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.each(['forks', 'vmForks'] as const)('test case\'s process.send() calls are handled', async (pool) => {
  const { stderr } = await runVitest({
    root: './fixtures/forks-channel',
    pool,
  })

  expect(stderr).toContain('⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯')
  expect(stderr).toContain('Error: [vitest-pool]: Unexpected call to process.send(). Make sure your test cases are not interfering with process\'s channel.')
})
