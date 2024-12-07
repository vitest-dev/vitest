// fix https://github.com/vitest-dev/vitest/issues/6690

import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('setup file imports the same modules', async () => {
  const { stderr, ctx } = await runBrowserTests(
    {
      root: './fixtures/setup-file',
    },
  )

  expect(stderr).toBe('')
  expect(
    Object.fromEntries(
      ctx.state.getFiles().map(f => [f.name, f.result.state]),
    ),
  ).toMatchInlineSnapshot(`
    {
      "module-equality.test.ts": "pass",
    }
  `)
})
