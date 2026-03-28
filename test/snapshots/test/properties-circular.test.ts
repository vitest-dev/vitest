import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('toMatchSnapshot with cyclic properties reports a mismatch instead of overflowing the stack', async () => {
  const root = join(import.meta.dirname, 'fixtures/properties-circular')
  const result = await runVitest({ root, update: 'new' })

  expect(result.stderr).toContain('Snapshot properties mismatched')
  expect(result.stderr).not.toContain('Maximum call stack size exceeded')
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "cyclic properties mismatch": Array [
          "Snapshot properties mismatched",
        ],
      },
    }
  `)
})
