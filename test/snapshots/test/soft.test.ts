import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('soft', async () => {
  const root = join(import.meta.dirname, 'fixtures/soft')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')
  const customFile1 = join(root, '__snapshots__/custom1.txt')
  const customFile2 = join(root, '__snapshots__/custom2.txt')

  // remove snapshots
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // create snapshots from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`toMatchSnapshot 1\`] = \`"--snap-1--"\`;

    exports[\`toMatchSnapshot 2\`] = \`"--snap-2--"\`;

    exports[\`toThrowErrorMatchingSnapshot 1\`] = \`[Error: --error-1--]\`;

    exports[\`toThrowErrorMatchingSnapshot 2\`] = \`[Error: --error-2--]\`;
    "
  `)
  expect(readFileSync(customFile1, 'utf-8')).toMatchInlineSnapshot(`"--file-1--"`)
  expect(readFileSync(customFile2, 'utf-8')).toMatchInlineSnapshot(`"--file-2--"`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "toMatchFileSnapshot": "passed",
        "toMatchSnapshot": "passed",
        "toThrowErrorMatchingSnapshot": "passed",
      },
    }
  `)

  // edit tests to introduce snapshot errors
  editFile(testFile, s => s
    .replace(`--snap-1--`, `--snap-1-edit--`)
    .replace(`--snap-2--`, `--snap-2-edit--`)
    .replace(`--file-1--`, `--file-1-edit--`)
    .replace(`--file-2--`, `--file-2-edit--`)
    .replace(`--error-1--`, `--error-1-edit--`)
    .replace(`--error-2--`, `--error-2-edit--`))

  result = await runVitest({ root, update: false })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > toMatchSnapshot
    Error: Snapshot \`toMatchSnapshot 1\` mismatched

    Expected: ""--snap-1--""
    Received: ""--snap-1-edit--""

     ❯ basic.test.ts:4:34
          2|
          3| test('toMatchSnapshot', () => {
          4|   expect.soft('--snap-1-edit--').toMatchSnapshot()
           |                                  ^
          5|   expect.soft('--snap-2-edit--').toMatchSnapshot()
          6| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

     FAIL  basic.test.ts > toMatchSnapshot
    Error: Snapshot \`toMatchSnapshot 2\` mismatched

    Expected: ""--snap-2--""
    Received: ""--snap-2-edit--""

     ❯ basic.test.ts:5:34
          3| test('toMatchSnapshot', () => {
          4|   expect.soft('--snap-1-edit--').toMatchSnapshot()
          5|   expect.soft('--snap-2-edit--').toMatchSnapshot()
           |                                  ^
          6| })
          7|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

     FAIL  basic.test.ts > toMatchFileSnapshot
    Error: Snapshot \`toMatchFileSnapshot 1\` mismatched

    Expected: "--file-1--"
    Received: "--file-1-edit--"

     ❯ basic.test.ts:9:3
          7|
          8| test('toMatchFileSnapshot', async () => {
          9|   await expect.soft('--file-1-edit--').toMatchFileSnapshot('./__snapsh…
           |   ^
         10|   await expect.soft('--file-2-edit--').toMatchFileSnapshot('./__snapsh…
         11| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

     FAIL  basic.test.ts > toMatchFileSnapshot
    Error: Snapshot \`toMatchFileSnapshot 2\` mismatched

    Expected: "--file-2--"
    Received: "--file-2-edit--"

     ❯ basic.test.ts:10:3
          8| test('toMatchFileSnapshot', async () => {
          9|   await expect.soft('--file-1-edit--').toMatchFileSnapshot('./__snapsh…
         10|   await expect.soft('--file-2-edit--').toMatchFileSnapshot('./__snapsh…
           |   ^
         11| })
         12|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

     FAIL  basic.test.ts > toThrowErrorMatchingSnapshot
    Error: Snapshot \`toThrowErrorMatchingSnapshot 1\` mismatched

    Expected: "[Error: --error-1--]"
    Received: "[Error: --error-1-edit--]"

     ❯ basic.test.ts:14:62
         12|
         13| test('toThrowErrorMatchingSnapshot', () => {
         14|   expect.soft(() => { throw new Error('--error-1-edit--') }).toThrowEr…
           |                                                              ^
         15|   expect.soft(() => { throw new Error('--error-2-edit--') }).toThrowEr…
         16| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

     FAIL  basic.test.ts > toThrowErrorMatchingSnapshot
    Error: Snapshot \`toThrowErrorMatchingSnapshot 2\` mismatched

    Expected: "[Error: --error-2--]"
    Received: "[Error: --error-2-edit--]"

     ❯ basic.test.ts:15:62
         13| test('toThrowErrorMatchingSnapshot', () => {
         14|   expect.soft(() => { throw new Error('--error-1-edit--') }).toThrowEr…
         15|   expect.soft(() => { throw new Error('--error-2-edit--') }).toThrowEr…
           |                                                              ^
         16| })
         17|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "toMatchFileSnapshot": Array [
          "Snapshot \`toMatchFileSnapshot 1\` mismatched",
          "Snapshot \`toMatchFileSnapshot 2\` mismatched",
        ],
        "toMatchSnapshot": Array [
          "Snapshot \`toMatchSnapshot 1\` mismatched",
          "Snapshot \`toMatchSnapshot 2\` mismatched",
        ],
        "toThrowErrorMatchingSnapshot": Array [
          "Snapshot \`toThrowErrorMatchingSnapshot 1\` mismatched",
          "Snapshot \`toThrowErrorMatchingSnapshot 2\` mismatched",
        ],
      },
    }
  `)

  // run with update
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`toMatchSnapshot 1\`] = \`"--snap-1-edit--"\`;

    exports[\`toMatchSnapshot 2\`] = \`"--snap-2-edit--"\`;

    exports[\`toThrowErrorMatchingSnapshot 1\`] = \`[Error: --error-1-edit--]\`;

    exports[\`toThrowErrorMatchingSnapshot 2\`] = \`[Error: --error-2-edit--]\`;
    "
  `)
  expect(readFileSync(customFile1, 'utf-8')).toMatchInlineSnapshot(`"--file-1-edit--"`)
  expect(readFileSync(customFile2, 'utf-8')).toMatchInlineSnapshot(`"--file-2-edit--"`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "toMatchFileSnapshot": "passed",
        "toMatchSnapshot": "passed",
        "toThrowErrorMatchingSnapshot": "passed",
      },
    }
  `)
})
