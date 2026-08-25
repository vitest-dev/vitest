import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertTestCounts, openExplorerItem, startHtmlReportPreview, startVitestUi } from './helper'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root: './fixtures/playwright-trace',
      watch: true,
      ui: true,
      open: false,
    })
    vitest = server.vitest
    baseURL = server.url
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('opens Playwright trace viewer', async ({ page }) => {
    await page.goto(baseURL)
    await assertTestCounts(page, { pass: 1, fail: 0 })
    await openExplorerItem(page, 'playwright trace')

    const openTrace = page.getByRole('link', { name: 'Open trace' })
    await expect(openTrace).toHaveAttribute('target', '_blank')
    const popupPromise = page.waitForEvent('popup')
    await openTrace.click()
    const popup = await popupPromise
    await expect(popup).toHaveTitle(/Trace Viewer/)
  })
})

test.describe('html reporter', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    const server = await startHtmlReportPreview(
      {
        root: './fixtures/playwright-trace',
        run: true,
        ui: false,
        reporters: 'html',
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
    await page.goto(baseURL)
    await assertTestCounts(page, { pass: 1, fail: 0 })
    await openExplorerItem(page, 'playwright trace')

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('link', { name: 'Open trace' }).click()
    const popup = await popupPromise
    await expect(popup).toHaveTitle(/Trace Viewer/)
  })
})
