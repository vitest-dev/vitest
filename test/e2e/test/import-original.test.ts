import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for(['forks', 'threads', 'vmThreads', 'vmForks'])(
  'importOriginal resolves correctly with queries - %s',
  async (pool) => {
    const { errorTree, stderr } = await runVitest({
      root: './fixtures/import-original',
      pool,
    }, [])

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "import-query.test.ts": {
          "importOriginal strips _vitest_original correctly with subsequent queries": "passed",
        },
      }
    `)
  },
)
