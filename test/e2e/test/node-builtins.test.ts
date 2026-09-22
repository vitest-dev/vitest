import { expect, onTestFinished, test, vi } from 'vitest'
import { runInlineTests } from '#test-utils'

const nodeMajor = Number(process.version.slice(1).split('.')[0])

test.runIf(nodeMajor >= 22)('can import node:sqlite', async () => {
  const { vitest, results } = await runInlineTests({
    'vitest.config.ts': {
      test: {
        pool: 'forks',
        execArgv: ['--experimental-sqlite', '--no-warnings=ExperimentalWarning'],
      },
    },
    'basic.test.ts': /* ts */`
      import { test, expect } from 'vitest'
      import sqlite from 'node:sqlite'

      test('sqlite', () => {
        console.log(sqlite)
      })
    `,
  })
  expect(vitest.stderr).toBe('')
  expect(results[0].ok()).toBe(true)
})

test.each(['forks', 'vmForks'] as const)('can import node builtins in jsdom when NODE_ENV=production, pool=%s', async (pool) => {
  vi.stubEnv('NODE_ENV', 'production')
  onTestFinished(() => {
    vi.unstubAllEnvs()
  })

  const { testTree } = await runInlineTests({
    'basic.test.ts': /* ts */`
      import { timingSafeEqual } from 'node:crypto'
      import { createHash } from 'crypto'
      import { test, expect } from 'vitest'

      test('builtins', () => {
        expect(timingSafeEqual(Buffer.from('a'), Buffer.from('a'))).toBe(true)
        expect(createHash('sha1').update('a').digest('hex')).toBe('86f7e437faa5a7fce15d1ddcb9eaeaea377667b8')
      })
    `,
  }, { environment: 'jsdom', pool })

  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "builtins": "passed",
      },
    }
  `)
})
