import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

const SPLITTER = '// --- TEST CASES ---'

function readTestCases(file: string) {
  return readFileSync(file, 'utf-8').split(SPLITTER)[1]
}

test('domain inline snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-inline')
  const testFile = join(root, 'basic.test.ts')

  // 1. purge inline snapshots to empty strings, restore test values
  editFile(testFile, s => s
    .replace(/toMatchDomainInlineSnapshot\(`[^`]*`/g, 'toMatchDomainInlineSnapshot(``'))

  // 2. create snapshots from scratch
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
    test('all literal', () => {
      expect({ name: 'alice', age: '30' }).toMatchDomainInlineSnapshot(\`
        name=alice
        age=30
      \`, 'kv')
    })

    test('with regex', () => {
      expect({ name: 'bob', score: '999', status: 'active' }).toMatchDomainInlineSnapshot(\`
        name=bob
        score=999
        status=active
      \`, 'kv')
    })
    "
  `)

  // 3. hand-edit inline snapshot to introduce regex pattern
  //    score=999 -> score=/\\d+/
  editFile(testFile, s => s
    .replace('score=999', 'score=/\\\\d+/'))

  // 4. run without update — regex matches, all pass
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

  // 5. edit test values: score '999' -> '42' (regex still matches),
  //    status 'active' -> 'inactive' (literal mismatch)
  editFile(testFile, s => s
    .replace(`score: '999'`, `score: '42'`)
    .replace(`status: 'active'`, `status: 'inactive'`))

  // 6. run without update — status mismatch causes failure
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

     ❯ basic.test.ts:113:60
        111|
        112| test('with regex', () => {
        113|   expect({ name: 'bob', score: '42', status: 'inactive' }).toMatchDoma…
           |                                                            ^
        114|     name=bob
        115|     score=/\\\\d+/

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

  // 7. run with update — should preserve score regex (matched),
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

  // 8. verify inline snapshot in source was rewritten correctly
  //    score regex preserved, status updated to 'inactive'
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    test('all literal', () => {
      expect({ name: 'alice', age: '30' }).toMatchDomainInlineSnapshot(\`
        name=alice
        age=30
      \`, 'kv')
    })

    test('with regex', () => {
      expect({ name: 'bob', score: '42', status: 'inactive' }).toMatchDomainInlineSnapshot(\`
        name=bob
        score=/\\\\d+/
        status=inactive
      \`, 'kv')
    })
    "
  `)
})
