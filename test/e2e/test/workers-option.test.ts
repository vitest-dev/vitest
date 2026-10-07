import { describe, expect, test, vi } from 'vitest'
import * as testUtils from '#test-utils'
import {
  getDefaultMaxWorkers,
  resolveMaxWorkers,
} from '../../../packages/vitest/src/utils/workers.js'

vi.mock(import('node:os'), async (importOriginal) => ({
  ...(await importOriginal()),
  default: {
    ...(await importOriginal()).default,
    availableParallelism: () => 10,
  },
}))

describe('workers util', () => {
  test('percent=50% should return 5', () => {
    expect(resolveMaxWorkers('50%')).toBe(5)
  })

  test('percent=-10% should return 1', () => {
    expect(resolveMaxWorkers('-10%')).toBe(1)
  })

  test('percent=110% should return 10', () => {
    expect(resolveMaxWorkers('110%')).toBe(10)
  })

  test('number strings and numbers are returned as is', () => {
    expect(resolveMaxWorkers('3')).toBe(3)
    expect(resolveMaxWorkers(4)).toBe(4)
  })

  test('default leaves one core free, half in watch mode', () => {
    expect(getDefaultMaxWorkers(false)).toBe(9)
    expect(getDefaultMaxWorkers(true)).toBe(5)
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
