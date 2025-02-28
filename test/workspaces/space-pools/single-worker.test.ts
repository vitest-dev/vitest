import type { UserConfig } from 'vitest/config'
import { expect, test } from 'vitest'

test('is single worker', () => {
  // @ts-expect-error -- internal
  const config: NonNullable<UserConfig['test']> = globalThis.__vitest_worker__.config

  if (config.pool === 'forks') {
    expect(config.poolOptions?.forks?.singleFork).toBe(true)
  }
  else {
    expect(config.pool).toBe('threads')
    expect(config.poolOptions?.threads?.singleThread).toBe(true)
  }
})
