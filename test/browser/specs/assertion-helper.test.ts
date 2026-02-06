import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('vi.helper hides internal stack traces', async () => {
  // TODO: errorTree by projects
  const { stderr, errorTree } = await runBrowserTests({
    root: './fixtures/assertion-helper',
  })

  expect(stderr).not.toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async": [
          "expected 'async' to deeply equal 'x'",
        ],
        "soft": [
          "expected 'soft' to deeply equal 'x'",
        ],
        "soft async": [
          "expected 'soft async' to deeply equal 'x'",
        ],
        "sync": [
          "expected 'sync' to deeply equal 'x'",
        ],
      },
    }
  `)
})
