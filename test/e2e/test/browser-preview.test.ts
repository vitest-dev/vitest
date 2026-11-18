import type { Browser } from 'playwright'
import { preview } from '@vitest/browser-preview'
import { chromium } from 'playwright'
import { expect, onTestFinished, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test(
  'preview provider scales the iframe without the browser UI',
  { tags: ['browser'] },
  async () => {
    let browser: Browser | undefined
    onTestFinished(() => browser?.close())

    const { stderr, testTree } = await runInlineTests(
      {
        'basic.test.ts': /* ts */ `
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('uses the configured viewport', () => {
  expect([innerWidth, innerHeight]).toEqual([414, 896])
})

test('fits the iframe into the window', async () => {
  document.body.innerHTML = '<div style="position:absolute;top:800px">bottom</div>'
  await expect.element(page.getByText('bottom')).toBeInViewport()
})

test('page.viewport resizes the iframe', async () => {
  await page.viewport(500, 400)
  expect([innerWidth, innerHeight]).toEqual([500, 400])
})
`,
      },
      {
        browser: {
          enabled: true,
          headless: false,
          ui: false,
          provider: preview(),
          instances: [{ browser: 'chromium' }],
        },
        $viteConfig: {
          plugins: [
            {
              name: 'open-preview-in-playwright',
              configureServer(server) {
                server.openBrowser = async () => {
                  // preview restores `server.open` right after the call
                  const url = String(server.config.server.open)
                  browser = await chromium.launch()
                  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
                  await page.goto(url)
                }
              },
            },
          ],
        },
      },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "fits the iframe into the window": "passed",
          "page.viewport resizes the iframe": "passed",
          "uses the configured viewport": "passed",
        },
      }
    `)
  },
)
