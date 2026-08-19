import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'

test('white space sensitive', async () => {
  const root = join(import.meta.dirname, 'fixtures/file')

  // check correct snapshot
  let vitest = await runVitest({ root })
  expect(vitest.exitCode).toBe(0)

  // check diff of wrong snapshot
  editFile(join(root, 'snapshot-1.txt'), s => s.trim())
  editFile(join(root, 'snapshot-2.txt'), s => s.replace('echo', 'ECHO'))
  vitest = await runVitest({ root })
  expect(vitest.stderr).toContain(`
- white space
+
+
+   white space
+
`)
  expect(vitest.stderr).toContain(`
-     ECHO "hello"
+     echo "hello"
`)
  expect(vitest.exitCode).toBe(1)
})

test('file snapshot cannot use the test snapshot path', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest'

test('file snapshot', async () => {
  await expect('content').toMatchFileSnapshot('__snapshots__/basic.test.ts.snap')
})
`,
  })

  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "file snapshot": [
          "File snapshot cannot use the same path as the test snapshot file: <root>/__snapshots__/basic.test.ts.snap",
        ],
      },
    }
  `)
})

test('file snapshot can use another test filename', async () => {
  const result = await runInlineTests({
    'other.test.ts': `
import { expect, test } from 'vitest'

test('file snapshot', async () => {
  await expect('content').toMatchFileSnapshot('__snapshots__/basic.test.ts.snap')
})
`,
  }, { update: true })

  expect(result.stderr).toBe('')
  expect(result.testTree()).toMatchInlineSnapshot(`
    {
      "other.test.ts": {
        "file snapshot": "passed",
      },
    }
  `)
  expect(result.fs.readFile('__snapshots__/basic.test.ts.snap')).toBe('content')
})
