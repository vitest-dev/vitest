import { type UserConfig, describe, expect, test, vi } from 'vitest'

import { getWorkersCountByPercentage } from 'vitest/src/utils/workers.js'
import * as testUtils from '../../test-utils'

vi.mock(import('node:os'), async importOriginal => ({
  ...await importOriginal(),
  cpus: () => Array.from({ length: 10 }),
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
