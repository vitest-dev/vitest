import * as testUtils from '#test-utils'
import { expect, test } from 'vitest'

test.each([
  { pool: 'threads' },
  { poolOption: 'vmThreads' },
  { poolOption: 'forks' },
  { poolOption: 'vmForks' },
] as const)('workers percent argument in $poolOption should not throw error', async ({ pool }) => {
  const { stderr } = await testUtils.runInlineTests(
    { 'basic.test.js': 'test("defined")' },
    { maxWorkers: '100%', pool, globals: true },
  )

  expect(stderr).toBe('')
})
