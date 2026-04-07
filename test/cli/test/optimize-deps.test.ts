import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for(['forks', 'threads', 'vmThreads', 'vmForks'])(
  'optimize deps optimizes them into node_modules/.vite - %s',
  async (pool) => {
    const { errorTree, stderr } = await runVitest({
      root: './fixtures/optimize-deps',
      pool,
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
  },
)
