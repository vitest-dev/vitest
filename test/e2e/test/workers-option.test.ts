import * as testUtils from '#test-utils'
import { describe, expect, test, vi } from 'vitest'
import { getWorkersCountByPercentage } from 'vitest/src/utils/workers.js'

vi.mock(import('node:os'), async importOriginal => ({
  ...(await importOriginal()),
  default: {
    ...(await importOriginal()).default,
    availableParallelism: () => 10,
  },
}))

describe('workers util', () => {
  test('percent=50% should return 5', () => {
    expect(getWorkersCountByPercentage('50%')).toBe(5)
  })

  test('percent=-10% should return 1', () => {
    expect(getWorkersCountByPercentage('-10%')).toBe(1)
  })

  test('percent=110% should return 10', () => {
    expect(getWorkersCountByPercentage('110%')).toBe(10)
  })
})

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
