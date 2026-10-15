import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test.for(['forks', 'vmThreads'] as const)(
  'import.meta.hot has a data object per module in %s',
  async (pool) => {
    const testFile = (environment: string) => `
      // @vitest-environment ${environment}
      import { expect, test } from 'vitest'
      import { hot } from './hot.js'

      test('import.meta.hot.data', () => {
        expect(import.meta.hot.data).toStrictEqual({})
        expect(hot.data).toStrictEqual({})
        expect(hot.data).not.toBe(import.meta.hot.data)
      })
    `
    const { stderr, testTree } = await runInlineTests(
      {
        'hot.js': `export const hot = import.meta.hot`,
        'jsdom.test.js': testFile('jsdom'),
        'happy-dom.test.js': testFile('happy-dom'),
      },
      { pool },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "happy-dom.test.js": {
          "import.meta.hot.data": "passed",
        },
        "jsdom.test.js": {
          "import.meta.hot.data": "passed",
        },
      }
    `)
  },
)
