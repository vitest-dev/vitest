import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

describe.each(['forks', 'threads'] as const)('%s', async (pool) => {
  test('is isolated', async () => {
    const { stderr, exitCode } = await runVitest({
      root: './fixtures/pool-isolation',
      include: ['isolated.test.ts'],
      pool,
      poolOptions: {
        // Use default value on the tested pool and disable on the other one
        [invertPool(pool)]: { isolate: false },
      },
      env: { TESTED_POOL: pool },
    })

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  })

  test('is not isolated', async () => {
    const { stderr, exitCode } = await runVitest({
      root: './fixtures/pool-isolation',
      include: ['non-isolated.test.ts'],
      pool,
      poolOptions: {
        [pool]: { isolate: false },
      },
      env: { TESTED_POOL: pool },
    })

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
  })
})

function invertPool(pool: 'threads' | 'forks') {
  return pool === 'threads' ? 'forks' : 'threads'
}
