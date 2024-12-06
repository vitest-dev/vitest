import type { UserConfig } from 'vitest/node'
import { describe, expect, test, vi } from 'vitest'

import { getWorkersCountByPercentage } from 'vitest/src/utils/workers.js'
import * as testUtils from '../../test-utils'

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

function runVitest(config: UserConfig) {
  return testUtils.runVitest({ ...config, root: './fixtures/workers-option' })
}

test('workers percent argument should not throw error', async () => {
  const { stderr } = await runVitest({ maxWorkers: '100%', minWorkers: '10%' })

  expect(stderr).toBe('')
})

test.each([
  { poolOption: 'threads' },
  { poolOption: 'vmThreads' },
  { poolOption: 'forks' },
  { poolOption: 'vmForks' },
] as const)('workers percent argument in $poolOption should not throw error', async ({ poolOption }) => {
  let workerOptions = {}

  if (poolOption.toLowerCase().includes('threads')) {
    workerOptions = { maxThreads: '100%', minThreads: '10%' }
  }

  if (poolOption.toLowerCase().includes('forks')) {
    workerOptions = { maxForks: '100%', minForks: '10%' }
  }

  const { stderr } = await runVitest({ poolOptions: { [poolOption]: workerOptions } })

  expect(stderr).toBe('')
})
