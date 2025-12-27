import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('worker', async () => {
  const { ctx, stderr } = await runBrowserTests({
    root: './fixtures/worker',
  })
  expect(stderr).toBe('')
  expect(Object.fromEntries(ctx.state.getFiles().map(f => [f.name, f.result.state]))).toMatchInlineSnapshot(`
    {
      "src/basic.test.ts": "pass",
    }
  `)
})
