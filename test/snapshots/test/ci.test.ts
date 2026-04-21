import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('CI behavior', async () => {
  // cleanup snapshot
  const root = path.join(import.meta.dirname, 'fixtures/ci')
  fs.rmSync(path.join(root, '__snapshots__'), { recursive: true, force: true })

  // snapshot fails with CI
  let result = await runVitestCli({
    nodeOptions: {
      env: {
        CI: 'true',
        GITHUB_ACTIONS: 'true',
      },
    },
  }, '--root', root)
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > basic
    Error: Snapshot \`basic 1\` mismatched
     ❯ basic.test.ts:4:16
          2|
          3| test("basic", () => {
          4|   expect("ok").toMatchSnapshot()
           |                ^
          5| })
          6|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)

  // snapshot created without CI
  result = await runVitestCli(
    {
      nodeOptions: {
        env: {
          CI: '',
          GITHUB_ACTIONS: '',
        },
      },
    },
    '--root',
    root,
  )
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.stdout).toContain('Snapshots  1 written')
})
