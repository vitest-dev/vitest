import { expect, test } from 'vitest'
import type { TestUserConfig } from 'vitest/config'

const pool = process.env.TESTED_POOL as "forks" | "threads";

test('is isolated', () => {
  // @ts-expect-error -- internal
  const config: TestUserConfig = globalThis.__vitest_worker__.config

  if (pool === 'forks') {
    expect(config.poolOptions?.forks?.isolate).toBe(true)
  }
  else {
    expect(pool).toBe('threads')
    expect(config.poolOptions?.threads?.isolate).toBe(true)
  }
})
