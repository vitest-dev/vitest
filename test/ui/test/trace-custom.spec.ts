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
    'page.setContent',
    'locator.evaluate',
    'expect.toBeVisible',
    'locator.click',
    'test finished',
  ])
  await expect(traceSteps.nth(0)).toHaveAttribute('data-test-range', 'end')
  await expect(traceSteps.nth(1)).toHaveAttribute('data-test-range', 'end')
  await expect(traceSteps.nth(2)).toHaveAttribute('data-test-range', 'end')
  await expect(traceSteps.nth(3)).toHaveAttribute('data-test-range', 'end')
  await expect(traceSteps.nth(0).locator('.text-blue-500')).toBeVisible()
  await expect(traceSteps.nth(3)).toHaveClass(/text-red-600/)

  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceFrame.getByRole('button', { name: 'Before action' })).toBeVisible()

  await traceSteps.nth(0).click()
  const editor = page.getByTestId('editor')
  const activeLine = editor.locator('.CodeMirror-activeline')
  await expect(activeLine).toHaveText(/await page\.setContent/)

  const traceEditorMarkers = editor.getByTestId('trace-editor-marker')
  await expect(traceEditorMarkers).toHaveCount(5)
  const setContentMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: page.setContent"]'))
  const evaluateMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: locator.evaluate"]'))
  const assertionMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: expect.toBeVisible"]'))
  const failedActionMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: locator.click"]'))
  const lifecycleMarker = traceEditorMarkers.and(page.locator('[aria-label="Select trace step: vitest:onAfterRetryTask"]'))
  await expect(setContentMarker).toHaveAttribute('aria-current', 'step')

  await traceSteps.nth(1).click()
  await expect(activeLine).toHaveText(/await page\.locator\('main'\)\.evaluate/)
  await expect(evaluateMarker).toHaveAttribute('aria-current', 'step')
  await expect(traceFrame.getByRole('button', { name: 'After action' })).toBeVisible()

  await traceSteps.nth(2).click()
  await expect(activeLine).toHaveText(/await expect\(page\.getByRole/)
  await expect(assertionMarker).toHaveAttribute('aria-current', 'step')

  await traceSteps.nth(3).click()
  await expect(activeLine).toHaveText(/name: 'Missing'/)
  await expect(failedActionMarker).toHaveAttribute('aria-current', 'step')

  await traceSteps.nth(4).click()
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
      'page.setContent',
      'attempt',
      'test finished',
    ])
    const lifecycleStep = traceView.getByTestId('trace-step').nth(2)
    if (index % 2 === 0) {
      await expect(lifecycleStep).toHaveClass(/text-red-600/)
    }
    else {
      await expect(lifecycleStep).not.toHaveClass(/text-red-600/)
    }
  }

  await traceOpenButtons.nth(0).click()
  await traceView.getByTestId('trace-step').nth(2).click()
  await expect(page.getByTestId('editor').locator('.CodeMirror-activeline')).toHaveText(/throw new Error\('Retry this attempt'\)/)
}
