import type { TestUserConfig } from 'vitest/node'
import { runVitest } from '#test-utils'
import { playwright } from '@vitest/browser-playwright'
import { expect, test } from 'vitest'

const configs: TestUserConfig[] = []
const pools: TestUserConfig[] = [
  { pool: 'threads' },
  { pool: 'forks' },
  { pool: 'threads', fileParallelism: false },
]

if (process.platform !== 'win32') {
  pools.push(
    {
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        fileParallelism: false,
        instances: [
          { browser: 'chromium' },
        ],
      },
    },
    {
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        fileParallelism: true,
        instances: [
          { browser: 'chromium' },
        ],
      },
    },
  )
}

for (const isolate of [true, false]) {
  for (const pool of pools) {
    configs.push({
      ...pool,
      isolate,
      browser: {
        ...pool.browser!,
        isolate,
      },
    })
  }
}

for (const config of configs) {
  test(
    `should bail with "${JSON.stringify(config)}"`,
    {
      retry: config.browser?.enabled ? 3 : 0,
    },
    async () => {
      const isParallel
        = (config.pool === 'threads' && config.fileParallelism !== false)
          || (config.pool === 'forks' && config.fileParallelism !== false)
          || (config.browser?.enabled && config.browser.fileParallelism)

      // THREADS here means that multiple tests are run parallel
      process.env.THREADS = isParallel ? 'true' : 'false'

      const { exitCode, stdout, ctx } = await runVitest({
        root: './fixtures/config/bail',
        bail: 1,
        ...config,
        env: {
          THREADS: process.env.THREADS,
        },
      }, [])

      expect(ctx?.config.pool).toBe(config.pool || 'forks')
      expect(ctx?.config.browser.enabled).toBe(config.browser?.enabled ?? false)

      const browser = config.browser?.enabled

      expect(exitCode).toBe(1)
      if (browser) {
        expect(stdout).toMatch(`✓ |chromium| test/first.test.ts > 1 - first.test.ts - this should pass`)
        expect(stdout).toMatch(`× |chromium| test/first.test.ts > 2 - first.test.ts - this should fail`)

        expect(stdout).not.toMatch('✓ |chromium| test/first.test.ts > 3 - first.test.ts - this should be skipped')
        expect(stdout).not.toMatch('✓ |chromium| test/second.test.ts > 1 - second.test.ts - this should be skipped')
        expect(stdout).not.toMatch('✓ |chromium| test/second.test.ts > 2 - second.test.ts - this should be skipped')
        expect(stdout).not.toMatch('✓ |chromium| test/second.test.ts > 3 - second.test.ts - this should be skipped')
      }
      else {
        expect(stdout).toMatch('✓ test/first.test.ts > 1 - first.test.ts - this should pass')
        expect(stdout).toMatch('× test/first.test.ts > 2 - first.test.ts - this should fail')

        expect(stdout).not.toMatch('✓ test/first.test.ts > 3 - first.test.ts - this should be skipped')
        expect(stdout).not.toMatch('✓ test/second.test.ts > 1 - second.test.ts - this should be skipped')
        expect(stdout).not.toMatch('✓ test/second.test.ts > 2 - second.test.ts - this should be skipped')
        expect(stdout).not.toMatch('✓ test/second.test.ts > 3 - second.test.ts - this should be skipped')
      }
    },
  )
}
