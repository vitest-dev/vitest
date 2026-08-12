import fs from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { replaceRoot, runVitest } from '../../test-utils'

test('reports a broken snapshot file', async () => {
  const root = join(import.meta.dirname, 'fixtures/broken-file')
  const snapshotDirectory = join(root, '__snapshots__')
  const snapshotFile = join(snapshotDirectory, 'basic.test.ts.snap')

  fs.mkdirSync(snapshotDirectory, { recursive: true })
  fs.writeFileSync(snapshotFile, 'exports[`broken snapshot 1`] = ;')

  // re-run without update
  let result = await runVitest({ root, update: 'none' })

  const errorTree = result.errorTree()
  errorTree.__unhandled_errors__ = errorTree.__unhandled_errors__.map(error => replaceRoot(error, root))
  expect(errorTree).toMatchInlineSnapshot(`
    {
      "__unhandled_errors__": [
        "Invalid snapshot file, please manually fix or delete it: <root>/__snapshots__/basic.test.ts.snap",
      ],
      "basic.test.ts": {
        "broken snapshot": "pending",
      },
    }
  `)

  // re-run with update
  result = await runVitest({ root, update: 'all' })
  const updateErrorTree = result.errorTree()
  updateErrorTree.__unhandled_errors__ = updateErrorTree.__unhandled_errors__.map(error => replaceRoot(error, root))
  expect(updateErrorTree).toEqual(errorTree)
})
