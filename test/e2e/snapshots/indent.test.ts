import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('white space sensitive', async () => {
  const root = join(import.meta.dirname, 'fixtures/indent')

  // ensure correct snapshot
  let vitest = await runVitest({ root, update: true })
  expect(vitest.exitCode).toBe(0)

  // check diff of wrong snapshot
  editFile(join(root, 'basic.test.ts'), s => s.replace('1111', 'aaaa').replace('2222', 'bbbb'))
  vitest = await runVitest({ root })
  expect(vitest.stderr).toContain(`
- 1111
+ aaaa
      xxxx {
      }
`)
  expect(vitest.stderr).toContain(`
- 2222
+ bbbb
      yyyy {
      }
`)
  expect(vitest.exitCode).toBe(1)
})
