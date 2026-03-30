import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

// TODO: all pools
test('optimize deps optimizes them into node_modules/.vite', async () => {
  const { errorTree, stderr } = await runVitest({
    root: './fixtures/optimize-deps',
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "ssr.test.ts": {
        "import.meta.url": "passed",
      },
      "web.test.ts": {
        "import.meta.url": "passed",
      },
    }
  `)
})
