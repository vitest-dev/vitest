import type { UserConfig } from 'vitest/config'
import { expect, test } from 'vitest'

test('is not isolated', () => {
  // @ts-expect-error -- internal
  const config: NonNullable<UserConfig['test']> = globalThis.__vitest_worker__.config

  if (config.pool === 'forks') {
    expect(config.poolOptions?.forks?.isolate).toBe(false)
  }
  else {
    expect(config.pool).toBe('threads')
    expect(config.poolOptions?.threads?.isolate).toBe(false)
  }
})
