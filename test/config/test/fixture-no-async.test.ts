import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('fixture parsing works for lowered async syntax', async () => {
  const { ctx } = await runVitest({
    root: path.resolve('fixtures/fixture-no-async'),
    reporters: ['tap-flat'],
  })
  expect(ctx?.state.getFiles().map(f => [f.name, f.result?.state])).toMatchInlineSnapshot(`
    [
      [
        "basic.test.ts",
        "pass",
      ],
    ]
  `)
})
