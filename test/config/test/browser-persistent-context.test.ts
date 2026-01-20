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
  process.env.TEST_EXPECTED_VALUE = '0'
  const result1 = await runVitest({ root })
  expect(result1.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "expectedValue = 0": "passed",
      },
    }
  `)
  // check user data
  expect(existsSync(userDataDir)).toBe(true)

  // 2nd run
  // localStorage is incremented during 1st run and
  // 2nd run should pick that up from persistent context
  process.env.TEST_EXPECTED_VALUE = '1'
  const result2 = await runVitest({ root })
  expect(result2.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "expectedValue = 1": "passed",
      },
    }
  `)
  // check user data
  expect(existsSync(userDataDir)).toBe(true)
})
