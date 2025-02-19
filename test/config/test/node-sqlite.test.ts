import { expect, test } from 'vitest'
import { runInlineTests, ts } from '../../test-utils'

const nodeMajor = Number(process.version.slice(1).split('.')[0])

test.runIf(nodeMajor >= 22)('import node:sqlite', async () => {
  const { vitest, results } = await runInlineTests({
    'vitest.config.ts': {
      test: {
        pool: 'forks',
        poolOptions: {
          forks: {
            execArgv: ['--experimental-sqlite'],
          },
        },
      },
    },
    'basic.test.ts': ts`
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
