import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

describe.each(['forks', 'threads'] as const)('%s', async (pool) => {
  test('is not isolated', async () => {
    const { stderr, exitCode } = await runVitest({
      root: './fixtures/pool-isolation',
      include: ['isolated.test.ts'],
      pool,
      isolate: false,
      env: { TESTED_POOL: pool },
    })

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  })
})
