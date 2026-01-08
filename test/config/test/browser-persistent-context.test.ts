import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('persistent context works in headless mode when not running in parallel', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-persistent-context')
  const userDataDir = resolve(root, 'node_modules/.cache/test-user-data')
  rmSync(userDataDir, { recursive: true, force: true })

  const { testTree } = await runVitest({ root })
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)

  // Verify user data directory was created
  expect(existsSync(userDataDir)).toBe(true)
})
