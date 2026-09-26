import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for(['forks', 'threads', 'vmThreads', 'vmForks'])(
  'does not optimize dependencies discovered from index.html - %s',
  async (pool) => {
    const { stderr, testTree } = await runVitest({
      root: './fixtures/vm-optimizer',
      pool,
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "unrelated to the index.html graph": "passed",
        },
      }
    `)
  },
)
