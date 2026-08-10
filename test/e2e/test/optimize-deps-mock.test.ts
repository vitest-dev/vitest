import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for(['forks', 'threads', 'vmThreads', 'vmForks'])(
  'optimize deps and mock - %s',
  async (pool) => {
    const { errorTree, stderr } = await runVitest({
      root: './fixtures/optimize-deps-mock',
      pool,
    })

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "basic": "passed",
        },
      }
    `)
  },
)
