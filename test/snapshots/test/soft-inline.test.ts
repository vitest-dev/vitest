import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('soft inline', async () => {
  const root = join(import.meta.dirname, 'fixtures/soft-inline')
  const testFile = join(root, 'basic.test.ts')

  // remove inline snapshots
  editFile(testFile, s => s
    .replace(/toMatchInlineSnapshot\(`[^`]*`\)/g, 'toMatchInlineSnapshot()')
    .replace(/toThrowErrorMatchingInlineSnapshot\(`[^`]*`\)/g, 'toThrowErrorMatchingInlineSnapshot()'))

  // create snapshots from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
    "import { expect, test } from 'vitest'

    test('toMatchInlineSnapshot', () => {
      expect.soft('--snap-1--').toMatchInlineSnapshot(\`"--snap-1--"\`)
      expect.soft('--snap-2--').toMatchInlineSnapshot(\`"--snap-2--"\`)
    })

    test('toThrowErrorMatchingInlineSnapshot', () => {
      expect.soft(() => { throw new Error('--error-1--') }).toThrowErrorMatchingInlineSnapshot(\`[Error: --error-1--]\`)
      expect.soft(() => { throw new Error('--error-2--') }).toThrowErrorMatchingInlineSnapshot(\`[Error: --error-2--]\`)
    })
    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "toMatchInlineSnapshot": "passed",
        "toThrowErrorMatchingInlineSnapshot": "passed",
      },
    }
  `)

  // edit tests to introduce snapshot errors
  editFile(testFile, s => s
    .replace('expect.soft(\'--snap-1--\')', 'expect.soft(\'--snap-1-edit--\')')
    .replace('expect.soft(\'--snap-2--\')', 'expect.soft(\'--snap-2-edit--\')')
    .replace('new Error(\'--error-1--\')', 'new Error(\'--error-1-edit--\')')
    .replace('new Error(\'--error-2--\')', 'new Error(\'--error-2-edit--\')'))

  result = await runVitest({ root, update: false })
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "toMatchInlineSnapshot": Array [
          "Snapshot \`toMatchInlineSnapshot 1\` mismatched",
          "Snapshot \`toMatchInlineSnapshot 2\` mismatched",
        ],
        "toThrowErrorMatchingInlineSnapshot": Array [
          "Snapshot \`toThrowErrorMatchingInlineSnapshot 1\` mismatched",
          "Snapshot \`toThrowErrorMatchingInlineSnapshot 2\` mismatched",
        ],
      },
    }
  `)

  // run with update
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
    "import { expect, test } from 'vitest'

    test('toMatchInlineSnapshot', () => {
      expect.soft('--snap-1-edit--').toMatchInlineSnapshot(\`"--snap-1-edit--"\`)
      expect.soft('--snap-2-edit--').toMatchInlineSnapshot(\`"--snap-2-edit--"\`)
    })

    test('toThrowErrorMatchingInlineSnapshot', () => {
      expect.soft(() => { throw new Error('--error-1-edit--') }).toThrowErrorMatchingInlineSnapshot(\`[Error: --error-1-edit--]\`)
      expect.soft(() => { throw new Error('--error-2-edit--') }).toThrowErrorMatchingInlineSnapshot(\`[Error: --error-2-edit--]\`)
    })
    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "toMatchInlineSnapshot": "passed",
        "toThrowErrorMatchingInlineSnapshot": "passed",
      },
    }
  `)
})
