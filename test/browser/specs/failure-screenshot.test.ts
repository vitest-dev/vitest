import type { TestFsStructure } from '../../test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import utilsContent from '../fixtures/expect-dom/utils?raw'

const testFilename = 'basic.test.ts'

async function runBrowserTests(structure: TestFsStructure) {
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

function extractScreenshotPath(string: string): string | undefined {
  return string.match(/- (vitest-test-.*?\.png)/)[1]
}

describe('failure screenshots', () => {
  describe('`toMatchScreenshot`', () => {
    test('usually does NOT produce a failure screenshot', async () => {
      const { stderr } = await runBrowserTests({
        [testFilename]: /* ts */ `
            import { page } from 'vitest/browser'
            import { test } from 'vitest'
            import { render } from './utils'

            test('screenshot-initial', async ({ expect }) => {
              render('<div data-testid="el">Test</div>')
              await expect(page.getByTestId('el')).toMatchScreenshot()
            })
          `,
        'utils.ts': utilsContent,
      })

      expect(stderr).toContain('No existing reference screenshot found; a new one was created.')
      expect(stderr).not.toContain('Failure screenshot:')
    })

    test('unstable screenshot fails produces a failure screenshot', async () => {
      const { stderr } = await runBrowserTests({
        [testFilename]: /* ts */ `
            import { page } from 'vitest/browser'
            import { test } from 'vitest'
            import { render } from './utils'

            test('screenshot-unstable', async ({ expect }) => {
              render('<div data-testid="el">Test</div>')
              await expect(page.getByTestId('el')).toMatchScreenshot({ timeout: 1 })
            })
          `,
        'utils.ts': utilsContent,
      })

      expect(stderr).toContain('Could not capture a stable screenshot within 1ms.')
      expect(stderr).toContain('Failure screenshot:')

      const screenshotPath = extractScreenshotPath(stderr)

      expect(screenshotPath).toContain(
        '.vitest/attachments/failure-screenshots/basic.test.ts/screenshot-unstable.png',
      )
    })

    test('`expect.soft` produces a failure screenshot', async () => {
      const { stderr } = await runBrowserTests({
        [testFilename]: /* ts */ `
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
      })

      expect(stderr).toContain('No existing reference screenshot found; a new one was created.')
      expect(stderr).toContain('expected 1 to be 2')
      expect(stderr).toContain('Failure screenshot:')

      const screenshotPath = extractScreenshotPath(stderr)

      expect(screenshotPath).toContain(
        '.vitest/attachments/failure-screenshots/basic.test.ts/screenshot-soft-then-fail.png',
      )
    })
  })

  describe('retry and repeats', () => {
    function extractFailureLines(stderr: string, root: string) {
      return stderr
        .split('\n')
        .filter((line) => /FAIL|AssertionError|Failure screenshot|\.png/.test(line))
        .map((line) => line.replace(root.split('/').at(-1)!, '<root>'))
        .join('\n')
    }

    function readReportedScreenshots(stderr: string) {
      const paths = [...new Set(stderr.match(/vitest-test-\S+?\.png/g))]
      return paths.map((path) => readFileSync(resolve(path)).toString('base64'))
    }

    test('saves and reports one screenshot per attempt', async () => {
      const { stderr, root } = await runBrowserTests({
        [testFilename]: /* ts */ `
          import { expect, test } from 'vitest'
          import { page } from 'vitest/browser'

          let attempt = 0
          test('repeated', { repeats: 1, retry: 1 }, async () => {
            attempt++
            document.body.innerHTML = \`<button>attempt \${attempt}</button>\`
            await page.getByText(\`attempt \${attempt}\`).click()
            expect(attempt).toBe(10)
          })
        `,
      })

      expect(extractFailureLines(stderr, root)).toMatchInlineSnapshot(`
        " FAIL  |chromium| basic.test.ts > repeated (initial run)
        AssertionError: expected 1 to be 10 // Object.is equality
        Failure screenshot:
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/repeated-0-0.png
         FAIL  |chromium| basic.test.ts > repeated (1st retry)
        AssertionError: expected 2 to be 10 // Object.is equality
        Failure screenshot:
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/repeated-0-1.png
         FAIL  |chromium| basic.test.ts > repeated (1st repeat)
        AssertionError: expected 3 to be 10 // Object.is equality
        Failure screenshot:
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/repeated-1-0.png
         FAIL  |chromium| basic.test.ts > repeated (1st retry of 1st repeat)
        AssertionError: expected 4 to be 10 // Object.is equality
        Failure screenshot:
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/repeated-1-1.png"
      `)
      expect(new Set(readReportedScreenshots(stderr)).size).toBe(4)
    })

    test('lists screenshots of every attempt that produced the error', async () => {
      const { stderr, root } = await runBrowserTests({
        [testFilename]: /* ts */ `
          import { expect, test } from 'vitest'

          test('soft', { retry: 1 }, () => {
            document.body.innerHTML = '<button>soft</button>'
            expect.soft(1).toBe(2)
            expect.soft(2).toBe(3)
          })
        `,
      })

      // screenshots are taken per attempt, so each soft error lists the same ones
      expect(extractFailureLines(stderr, root)).toMatchInlineSnapshot(`
        " FAIL  |chromium| basic.test.ts > soft (initial run, 1st retry)
        AssertionError: expected 1 to be 2 // Object.is equality
        Failure screenshots:
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/soft-0-0.png
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/soft-0-1.png
         FAIL  |chromium| basic.test.ts > soft (initial run, 1st retry)
        AssertionError: expected 2 to be 3 // Object.is equality
        Failure screenshots:
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/soft-0-0.png
          - <root>/.vitest/attachments/failure-screenshots/basic.test.ts/soft-0-1.png"
      `)
    })
  })
})
