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
  await assertTestCounts(page, { pass: 2, fail: 0 })
  await openExplorerItem(page, 'custom trace')

  const traceView = page.getByTestId('trace-view')
  await expect(traceView).toBeVisible()
  await expect(page.locator('#details-splitpanes')).toHaveClass(/splitpanes--horizontal/)

  const traceSteps = traceView.getByTestId('trace-step')
  await expect(traceView.getByTestId('trace-step-name')).toHaveText([
    'before action',
    'action',
    'test finished',
  ])
  await expect(traceSteps.nth(1)).toHaveAttribute('data-test-range', 'end')
  await expect(traceSteps.nth(1).locator('.text-blue-500')).toBeVisible()

  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceFrame.getByRole('button', { name: 'Before action' })).toBeVisible()

  await traceSteps.nth(0).click()
  const editor = page.getByTestId('editor')
  const activeLine = editor.locator('.CodeMirror-activeline')
  await expect(activeLine).toHaveText(/await recorder\.snapshot\('before action'\)/)

  const traceEditorMarkers = editor.getByTestId('trace-editor-marker')
  await expect(traceEditorMarkers).toHaveCount(3)
  const snapshotMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: before action"]'))
  const actionMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: action"]'))
  const lifecycleMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: vitest:onAfterRetryTask"]'))
  await expect(snapshotMarker).toHaveAttribute('aria-current', 'step')

  await traceSteps.nth(1).click()
  await expect(activeLine).toHaveText(/const result = await recorder\.mark\('action'/)
  await expect(actionMarker).toHaveAttribute('aria-current', 'step')
  await expect(traceFrame.getByRole('button', { name: 'After action' })).toBeVisible()

  await traceSteps.nth(2).click()
  await expect(activeLine).toHaveText(/test\('custom trace'/)
  await expect(lifecycleMarker).toHaveAttribute('aria-current', 'step')

  await page.goto(baseURL)
  await openExplorerItem(page, 'custom trace attempts')
  const traceOpenButtons = page.getByTestId('trace-open-button')
  await expect(traceOpenButtons).toHaveText([
    'Open trace viewer',
    'Open trace viewer Retry 1',
    'Open trace viewer Repeat 1',
    'Open trace viewer Retry 1 / Repeat 1',
  ])

  for (let index = 0; index < 4; index++) {
    await traceOpenButtons.nth(index).click()
    await expect(traceView.getByTestId('trace-step-name')).toHaveText([
      'attempt',
      'test finished',
    ])
    const lifecycleStep = traceView.getByTestId('trace-step').nth(1)
    if (index % 2 === 0) {
      await expect(lifecycleStep).toHaveClass(/text-red-600/)
    }
    else {
      await expect(lifecycleStep).not.toHaveClass(/text-red-600/)
    }
  }
}
