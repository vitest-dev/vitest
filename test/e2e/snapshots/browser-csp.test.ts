import fs from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('loads a snapshot without unsafe-eval', async () => {
  const root = join(import.meta.dirname, 'fixtures/browser-csp')
  const snapshotDirectory = join(root, '__snapshots__')

  // clean slate
  fs.rmSync(snapshotDirectory, { force: true, recursive: true })

  // create snapshot from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "snapshot": "passed",
        "unsafe eval is blocked": "passed",
      },
    }
  `)

  // re-run without update
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "snapshot": "passed",
        "unsafe eval is blocked": "passed",
      },
    }
  `)

  // re-run with server-side execution disabled
  result = await runVitest({
    root,
    update: 'none',
    api: { allowExec: false },
  })
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "__unhandled_errors__": [
        "Cannot read snapshot file because browser API exec operations are disabled. See https://vitest.dev/config/api.",
      ],
      "basic.test.ts": {
        "snapshot": "pending",
        "unsafe eval is blocked": "pending",
      },
    }
  `)
})
