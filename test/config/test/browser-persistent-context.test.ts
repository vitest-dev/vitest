import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('persistent context works', async () => {
  // clean user data dir
  const root = resolve(import.meta.dirname, '../fixtures/browser-persistent-context')
  const userDataDir = resolve(root, 'node_modules/.cache/test-user-data')
  rmSync(userDataDir, { recursive: true, force: true })

  // first run
  process.env.TEST_PERSISTENT_CONTEXT = '0'
  const result1 = await runVitest({ root })
  expect(result1.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)

  // 2nd run (localStorage is incremented and persisted)
  process.env.TEST_PERSISTENT_CONTEXT = '1'
  const result2 = await runVitest({ root })
  expect(result2.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)

  // check user data
  expect(existsSync(userDataDir)).toBe(true)
})
