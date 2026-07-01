import type { TestFsStructure } from '../../test-utils'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import utilsContent from '../fixtures/expect-dom/utils?raw'

const testFilename = 'basic.test.ts'

async function runBrowserTests(
  structure: TestFsStructure,
) {
  return runInlineTests({
    ...structure,
    'vitest.config.js': `
      import { instances, provider } from '../settings.ts'

      export default {
        test: {
          browser: {
            enabled: true,
            screenshotFailures: true,
            provider,
            ui: false,
            headless: true,
            instances: instances.slice(0, 1), // logic not bound to browser instance
          },
          reporters: ['verbose'],
          update: 'new',
        },
      }`,
  })
}

describe('failure screenshots', () => {
  describe('`toMatchScreenshot`', () => {
    test('usually does NOT produce a failure screenshot', async () => {
      const { stderr } = await runBrowserTests(
        {
          [testFilename]: /* ts */`
            import { page } from 'vitest/browser'
            import { test } from 'vitest'
            import { render } from './utils'

            test('screenshot-initial', async ({ expect }) => {
              render('<div data-testid="el">Test</div>')
              await expect(page.getByTestId('el')).toMatchScreenshot()
            })
          `,
          'utils.ts': utilsContent,
        },
      )

      expect(stderr).toContain('No existing reference screenshot found; a new one was created.')
      expect(stderr).not.toContain('Failure screenshot:')
    })

    test('unstable screenshot fails produces a failure screenshot', async () => {
      const { stderr } = await runBrowserTests(
        {
          [testFilename]: /* ts */`
            import { page } from 'vitest/browser'
            import { test } from 'vitest'
            import { render } from './utils'

            test('screenshot-unstable', async ({ expect }) => {
              render('<div data-testid="el">Test</div>')
              await expect(page.getByTestId('el')).toMatchScreenshot({ timeout: 1 })
            })
          `,
          'utils.ts': utilsContent,
        },
      )

      expect(stderr).toContain('Could not capture a stable screenshot; timed out in 1ms (test.timeout.action).')
      expect(stderr).toContain('Failure screenshot:')
    })

    test('`expect.soft` produces a failure screenshot', async () => {
      const { stderr } = await runBrowserTests(
        {
          [testFilename]: /* ts */`
            import { page } from 'vitest/browser'
            import { test } from 'vitest'
            import { render } from './utils'

            test('screenshot-soft-then-fail', async ({ expect }) => {
              render('<div data-testid="el">Test</div>')
              await expect.soft(page.getByTestId('el')).toMatchScreenshot()
              expect(1).toBe(2)
            })
          `,
          'utils.ts': utilsContent,
        },
      )

      expect(stderr).toContain('No existing reference screenshot found; a new one was created.')
      expect(stderr).toContain('expected 1 to be 2')
      expect(stderr).toContain('Failure screenshot:')
    })
  })
})
