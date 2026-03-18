import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'

const SPLITTER = '// --- TEST CASES ---'

function readTestCases(file: string) {
  return readFileSync(file, 'utf-8').split(SPLITTER)[1]
}

test('domain inline snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-inline')
  const testFile = join(root, 'basic.test.ts')

  // purge inline snapshots to empty strings, restore test values
  editFile(testFile, s => s
    .replace(/toMatchDomainInlineSnapshot\(`[^`]*`/g, 'toMatchDomainInlineSnapshot(``'))

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

     ❯ basic.test.ts:15:60
         13|
         14| test('with regex', () => {
         15|   expect({ name: 'bob', score: '42', status: 'inactive' }).toMatchDoma…
           |                                                            ^
         16|     name=bob
         17|     score=/\\\\d+/

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

test('domain multiple inline at same location - success', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest';

test('basic', () => {
  for (let i = 0; i < 3; i++) {
    document.body.innerHTML = "<p>OK</p>";
    expect(document.body).toMatchAriaInlineSnapshot();
  }
});
`,
  }, {
    environment: 'happy-dom',
    update: 'new',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "basic": "passed",
      },
    }
  `)
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "
    import { expect, test } from 'vitest';

    test('basic', () => {
      for (let i = 0; i < 3; i++) {
        document.body.innerHTML = "<p>OK</p>";
        expect(document.body).toMatchAriaInlineSnapshot(\`- paragraph: OK\`);
      }
    });
    "
  `)
})

test('domain multiple inline at same location - fail', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest';

test('basic', () => {
  for (let i = 0; i < 3; i++) {
    document.body.innerHTML = "<p>count - " + i + "</p>";
    expect(document.body).toMatchAriaInlineSnapshot();
  }
});
`,
  }, {
    environment: 'happy-dom',
    update: 'new',
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > basic
    Error: toMatchDomainInlineSnapshot with different snapshots cannot be called at the same location

    - Expected
    + Received


    - - paragraph: count - 0
    + - paragraph: count - 1


     ❯ basic.test.ts:7:27
          5|   for (let i = 0; i < 3; i++) {
          6|     document.body.innerHTML = "<p>count - " + i + "</p>";
          7|     expect(document.body).toMatchAriaInlineSnapshot();
           |                           ^
          8|   }
          9| });

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "basic": Array [
          "toMatchDomainInlineSnapshot with different snapshots cannot be called at the same location",
        ],
      },
    }
  `)
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "
    import { expect, test } from 'vitest';

    test('basic', () => {
      for (let i = 0; i < 3; i++) {
        document.body.innerHTML = "<p>count - " + i + "</p>";
        expect(document.body).toMatchAriaInlineSnapshot();
      }
    });
    "
  `)
})
