import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertTestCounts, openExplorerItem, startHtmlReportPreview, startVitestUi } from './helper'

const root = './fixtures/trace-failure-only'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root,
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

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL)
    await assertTestCounts(page, { pass: 1, fail: 1 })
  })

  test('basic', async ({ page }) => {
    await testBasic(page)
  })
})

test.describe('html reporter', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    const server = await startHtmlReportPreview(
      { root, run: true, ui: false, reporters: 'html' },
      { root, build: { outDir: '.vitest' } },
    )
    previewServer = server.previewServer
    baseURL = `${server.url}/`
  })

  test.afterAll(async () => {
    await previewServer.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL)
    await assertTestCounts(page, { pass: 1, fail: 1 })
  })

  test('basic', async ({ page }) => {
    await testBasic(page)
  })
})

async function testBasic(page: Page) {
  const traceView = page.getByTestId('trace-view')

  // failed test keeps the full step timeline
  await openExplorerItem(page, 'basic')
  await expect(traceView).toBeVisible()
  const traceSteps = traceView.getByTestId('trace-step-name')
  await expect(traceSteps).toHaveText([
    'toHaveTextContent',
    'toHaveAccessibleName',
    'toHaveTextContent [ERROR]',
    'test finished',
  ])

  // steps before the end have no snapshot
  await traceSteps.nth(1).click()
  await expect(traceView.getByText('No snapshot captured for this trace step')).toBeVisible()

  // the end of the failed test is replayed from its snapshot
  await traceSteps.nth(3).click()
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceFrame.getByRole('button', { name: 'hello' })).toBeVisible()

  // passed test has no trace
  await openExplorerItem(page, 'pass')
  await expect(traceView.getByText('No trace found')).toBeVisible()
}
