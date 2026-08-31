import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertTestCounts, openExplorerItem, startHtmlReportPreview, startVitestUi } from './helper'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async ({}, testInfo) => {
    const server = await startVitestUi({
      root: './fixtures/playwright-trace',
      watch: true,
      ui: true,
      open: false,
      browser: {
        // Playwright Test otherwise injects one worker-shared trace directory into nested browser launches.
        trace: { mode: 'on', tracesDir: testInfo.outputPath('vitest-traces') },
      },
    })
    vitest = server.vitest
    baseURL = server.url
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('opens Playwright trace viewer', async ({ page }) => {
    await testPlaywrightTrace(page, baseURL)
  })
})

test.describe('html reporter', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async ({}, testInfo) => {
    const server = await startHtmlReportPreview(
      {
        root: './fixtures/playwright-trace',
        run: true,
        ui: false,
        reporters: 'html',
        browser: {
          // Playwright Test otherwise injects one worker-shared trace directory into nested browser launches.
          trace: { mode: 'on', tracesDir: testInfo.outputPath('vitest-traces') },
        },
      },
      {
        root: './fixtures/playwright-trace',
        build: { outDir: '.vitest' },
      },
    )
    previewServer = server.previewServer
    baseURL = `${server.url}/`
  })

  test.afterAll(async () => {
    await previewServer.close()
  })

  test('opens Playwright trace viewer', async ({ page }) => {
    await testPlaywrightTrace(page, baseURL)
  })
})

async function testPlaywrightTrace(page: Page, baseURL: string) {
  await mockTraceViewer(page)
  await page.goto(baseURL)
  await assertTestCounts(page, { pass: 1, fail: 0 })
  await openExplorerItem(page, 'playwright trace')

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open trace' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL('https://trace.playwright.dev/next/')
  await expect(popup).toHaveTitle('Loaded Playwright Trace')
}

async function mockTraceViewer(page: Page) {
  await page.context().route('https://trace.playwright.dev/next/', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<script>
        addEventListener('message', (event) => {
          if (event.data?.method === 'load' && event.data.params?.trace instanceof Blob && event.data.params.trace.size > 0)
            document.title = 'Loaded Playwright Trace'
        })
        opener.postMessage({ method: 'ready' }, '*')
      </script>`,
    })
  })
}
