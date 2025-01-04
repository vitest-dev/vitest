import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

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
