import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'
import { extractInlineSnaphsots } from './utils'

function readTestCases(file: string) {
  return extractInlineSnaphsots(readFileSync(file, 'utf-8'))
}

test('domain inline snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-inline')
  const testFile = join(root, 'basic.test.ts')

  // purge inline snapshots to empty strings, restore test values
  editFile(testFile, s => s
    .replace(/toMatchKvInlineSnapshot\(`[^`]*`/g, 'toMatchKvInlineSnapshot('))

  // create snapshots from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": "passed",
      },
    }
  `)
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    expect({ name: 'alice', age: '30' }).toMatchKvInlineSnapshot(\`
        name=alice
        age=30
      \`)

    expect({ name: 'bob', score: '999', status: 'active' }).toMatchKvInlineSnapshot(\`
        name=bob
        score=999
        status=active
      \`)
    "
  `)

  // hand-edit inline snapshot to introduce regex pattern
  //    score=999 -> score=/\\d+/
  editFile(testFile, s => s
    .replace('score=999', 'score=/\\\\d+/'))

  // run without update — regex matches, all pass
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": "passed",
      },
    }
  `)

  // edit test values: score '999' -> '42' (regex still matches),
  //    status 'active' -> 'inactive' (literal mismatch)
  editFile(testFile, s => s
    .replace(`score: '999'`, `score: '42'`)
    .replace(`status: 'active'`, `status: 'inactive'`))

  // run without update — status mismatch causes failure
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > with regex
    Error: Snapshot \`with regex 1\` mismatched

    - Expected
    + Received

      name=bob
      score=/\\d+/
    - status=active
    + status=inactive

     ❯ basic.test.ts:12:60
         10|
         11| test('with regex', () => {
         12|   expect({ name: 'bob', score: '42', status: 'inactive' }).toMatchKvIn…
           |                                                            ^
         13|     name=bob
         14|     score=/\\\\d+/

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": Array [
          "Snapshot \`with regex 1\` mismatched",
        ],
      },
    }
  `)

  // run with update — should preserve score regex (matched),
  //    overwrite status with literal (didn't match)
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": "passed",
      },
    }
  `)

  // verify inline snapshot in source was rewritten correctly
  //    score regex preserved, status updated to 'inactive'
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    expect({ name: 'alice', age: '30' }).toMatchKvInlineSnapshot(\`
        name=alice
        age=30
      \`)

    expect({ name: 'bob', score: '42', status: 'inactive' }).toMatchKvInlineSnapshot(\`
        name=bob
        score=/\\\\d+/
        status=inactive
      \`)
    "
  `)
})
