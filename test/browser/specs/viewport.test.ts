import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('viewport', async () => {
  const { stderr, ctx } = await runBrowserTests({
    root: './fixtures/viewport',
  })

  expect(stderr).toBe('')
  expect(
    Object.fromEntries(
      ctx.state.getFiles().map(f => [f.name, f.result.state]),
    ),
  ).toMatchInlineSnapshot(`
    {
      "basic.test.ts": "pass",
    }
  `)
})
