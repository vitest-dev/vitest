import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test('oxc config on browser', async () => {
  const result = await runInlineTests({
    // needs a config file to reproduce
    // https://github.com/vitest-dev/vitest/issues/9800
    'vitest.config.ts': `
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  },
  oxc: {
    jsx: {
      refresh: false,
    }
  }
})
`,
    'basic.test.ts': `
import { test } from "vitest";
test('basic', () => {});
`,
  })

  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)
})
