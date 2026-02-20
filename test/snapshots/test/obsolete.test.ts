import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('obsolete snapshot fails with update:none', async () => {
  // cleanup snapshot
  const root = path.join(import.meta.dirname, 'fixtures/obsolete')
  fs.rmSync(path.join(root, 'src/__snapshots__'), { recursive: true, force: true })

  // initial run to write snapshot
  let result = await runVitest({ root, update: true })
  expect(result.stderr).toBe('')
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "src/test1.test.ts": Object {
        "bar": "passed",
        "foo": "passed",
        "fuu": "passed",
      },
      "src/test2.test.ts": Object {
        "bar": "passed",
        "foo": "passed",
      },
    }
  `)

  // test fails with obsolete snapshots
  result = await runVitest({
    root,
    update: 'none',
    env: {
      TEST_OBSOLETE: 'true',
    },
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  src/test1.test.ts [ src/test1.test.ts ]
    Error: Obsolete snapshots found when no snapshot update is expected.
    · foo 1
    · fuu 1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "src/test1.test.ts": Object {
        "__module_errors__": Array [
          "Obsolete snapshots found when no snapshot update is expected.
    · foo 1
    · fuu 1
    ",
        ],
        "bar": "passed",
        "foo": "passed",
        "fuu": "passed",
      },
      "src/test2.test.ts": Object {
        "bar": "passed",
        "foo": "passed",
      },
    }
  `)
})
