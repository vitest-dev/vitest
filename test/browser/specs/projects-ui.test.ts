import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import { provider } from '../settings'

test.runIf(provider.name === 'playwright')('browser ui enabled in projects setup (#10993)', async () => {
  const { stderr, exitCode, testTree } = await runInlineTests(
    {
      'basic.test.ts': `
        import { expect, test } from 'vitest'

        test('works', () => {
          expect(1 + 1).toBe(2)
        })
      `,
    },
    {
      watch: false,
      reporters: 'none',
      projects: [
        {
          test: {
            browser: {
              enabled: true,
              headless: true,
              ui: true,
              provider,
              instances: [{ browser: 'chromium' }],
            },
          },
        },
      ],
    },
  )

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "works": "passed",
      },
    }
  `)
})
