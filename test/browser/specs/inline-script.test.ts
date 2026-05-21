import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('escape inline script', async () => {
  const result = await runBrowserTests({
    root: './fixtures/inline-script',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "provide": "passed",
      },
    }
  `)
})
