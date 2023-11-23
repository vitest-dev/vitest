import { type UserConfig, expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

const configs: UserConfig[] = []
const pools: UserConfig[] = [{ pool: 'threads' }, { pool: 'forks' }, { pool: 'threads', poolOptions: { threads: { singleThread: true } } }]

if (process.platform !== 'win32')
  pools.push({ browser: { enabled: true, name: 'chromium', provider: 'playwright' } })

for (const isolate of [true, false]) {
  for (const pool of pools) {
    configs.push({
      ...pool,
      poolOptions: {
        threads: {
          ...pool.poolOptions?.threads,
          isolate,
        },
        forks: { isolate },
      },
    })
  }
}

for (const config of configs) {
  test(`should bail with "${JSON.stringify(config)}"`, async () => {
    const isParallel
      = (config.pool === 'threads' && config.poolOptions?.threads?.singleThread !== true)
      || (config.pool === 'forks' && config.poolOptions?.forks?.singleFork !== true)

    // THREADS here means that multiple tests are run parallel
    process.env.THREADS = isParallel ? 'true' : 'false'

    const { exitCode, stdout } = await runVitest({
      root: './fixtures',
      bail: 1,
      ...config,
    })

    expect(exitCode).toBe(1)
    expect(stdout).toMatch('✓ test/first.test.ts > 1 - first.test.ts - this should pass')
    expect(stdout).toMatch('× test/first.test.ts > 2 - first.test.ts - this should fail')

    // Cancelled tests should not be run
    expect(stdout).not.toMatch('test/first.test.ts > 3 - first.test.ts - this should be skipped')
    expect(stdout).not.toMatch('test/second.test.ts > 1 - second.test.ts - this should be skipped')
    expect(stdout).not.toMatch('test/second.test.ts > 2 - second.test.ts - this should be skipped')
    expect(stdout).not.toMatch('test/second.test.ts > 3 - second.test.ts - this should be skipped')
  }, {
    retry: config.browser?.enabled ? 3 : 0,
  })
}
