import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('browser root', async () => {
  process.env.BROWSER_DEFINE_TEST_PROEJCT = 'false'
  const { testTree, stderr } = await runVitest({
    root: './fixtures/browser-define',
    browser: {
      headless: true,
    },
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "passes": "passed",
      },
    }
  `)
})

test('browser proejct', async () => {
  process.env.BROWSER_DEFINE_TEST_PROEJCT = 'true'
  const { testTree, stderr } = await runVitest({
    root: './fixtures/browser-define',
    browser: {
      headless: true,
    },
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "passes": "passed",
      },
    }
  `)
})
