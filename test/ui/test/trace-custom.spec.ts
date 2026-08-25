import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertTestCounts, openExplorerItem, startHtmlReportPreview, startVitestUi } from './helper'

test.describe('custom trace artifact', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root: './fixtures/trace-custom',
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

  test('replays trace recorded from a node test', async ({ page }) => {
    await testCustomTrace(page, baseURL)
  })
})

test.describe('custom trace artifact html reporter', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    const root = './fixtures/trace-custom'
    const server = await startHtmlReportPreview(
      {
        root,
        run: true,
        ui: false,
        reporters: 'html',
      },
      {
        root,
        build: { outDir: '.vitest' },
      },
    )
    previewServer = server.previewServer
    baseURL = `${server.url}/`
  })

  test.afterAll(async () => {
    await previewServer.close()
  })

  test('replays trace recorded from a node test', async ({ page }) => {
    await testCustomTrace(page, baseURL)
  })
})

async function testCustomTrace(page: Page, baseURL: string) {
  await page.goto(baseURL)
  await assertTestCounts(page, { pass: 1, fail: 0 })
  await openExplorerItem(page, 'custom trace')

  const traceView = page.getByTestId('trace-view')
  await expect(traceView).toBeVisible()
  await expect(page.locator('#details-splitpanes')).toHaveClass(/splitpanes--horizontal/)

  const traceSteps = traceView.getByTestId('trace-step')
  await expect(traceView.getByTestId('trace-step-name')).toHaveText([
    'before action',
    'after action',
  ])

  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceFrame.getByRole('button', { name: 'Before action' })).toBeVisible()

  await traceSteps.nth(0).click()
  const editor = page.getByTestId('editor')
  const activeLine = editor.locator('.CodeMirror-activeline')
  await expect(activeLine).toHaveText(/await trace\.snapshot\('before action'\)/)

  const traceEditorMarkers = editor.getByTestId('trace-editor-marker')
  await expect(traceEditorMarkers).toHaveCount(2)
  await expect(traceEditorMarkers.nth(0)).toHaveAttribute('aria-current', 'step')

  await traceSteps.nth(1).click()
  await expect(activeLine).toHaveText(/await trace\.snapshot\('after action'\)/)
  await expect(traceEditorMarkers.nth(1)).toHaveAttribute('aria-current', 'step')
  await expect(traceFrame.getByRole('button', { name: 'After action' })).toBeVisible()
}
