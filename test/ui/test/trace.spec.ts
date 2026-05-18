import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertTestCounts, openExplorerItem, startHtmlReportPreview, startVitestUi } from './helper'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    const root = './fixtures/trace'
    const server = await startVitestUi({
      root,
      watch: true,
      ui: true,
      open: false,
    })
    vitest = server.vitest
    baseURL = `${server.url}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL)
    await assertTestCounts(page, { pass: 11, fail: 0 })
  })

  test('basic', async ({ page }) => {
    await testBasic(page)
  })

  test('viewport', async ({ page }) => {
    await testViewport(page)
  })

  test('pseudo-state', async ({ page }) => {
    await testPseudoState(page)
  })

  test('css-link', async ({ page }) => {
    await testCssLink(page)
  })

  test('image', async ({ page }) => {
    await testImage(page)
  })

  test('scroll', async ({ page }) => {
    await testScroll(page)
  })

  test('attempts', async ({ page }) => {
    await testAttempts(page)
  })
})

test.describe('html reporter', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    const root = './fixtures/trace'
    const server = await startHtmlReportPreview(
      {
        root,
        run: true,
        ui: false,
        reporters: 'html',
        browser: {
          traceView: {
            enabled: true,
            inlineImages: true,
          },
        },
      },
      {
        root,
        build: { outDir: 'html' },
      },
    )
    previewServer = server.previewServer
    baseURL = `${server.url}/`
  })

  test.afterAll(async () => {
    await previewServer.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL)
    await assertTestCounts(page, { pass: 11, fail: 0 })
  })

  test('basic', async ({ page }) => {
    await page.goto(baseURL)
    await testBasic(page)
  })

  test('viewport', async ({ page }) => {
    await testViewport(page)
  })

  test('pseudo-state', async ({ page }) => {
    await testPseudoState(page)
  })

  test('css-link', async ({ page }) => {
    await testCssLink(page)
  })

  test('image', async ({ page }) => {
    await testImage(page)
  })

  test('scroll', async ({ page }) => {
    await testScroll(page)
  })

  test('attempts', async ({ page }) => {
    await testAttempts(page)
  })
})

async function testBasic(page: Page) {
  // selecting test case opens trace viewer
  const traceView = page.getByTestId('trace-view')
  await expect(traceView).toBeHidden()
  await openExplorerItem(page, 'simple')
  await expect(traceView).toBeVisible()

  // selecting steps should open source code view
  const traceSteps = traceView.getByTestId('trace-step-name')
  await expect(page.getByTestId('btn-report')).toContainClass('tab-button-active')
  await traceSteps.getByText('Render simple').click()
  await expect(page.getByTestId('btn-code')).toContainClass('tab-button-active')

  // verify snapshot replay in iframe
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceFrame.getByRole('button', { name: 'Simple' })).toBeVisible()

  // verify selector highlight
  await expect(traceFrame.getByTestId('trace-view-highlight')).toBeVisible()

  // verify selecting another test switches trace viewer
  await openExplorerItem(page, 'switch-target')
  await expect(traceView).toBeVisible()
  await expect(traceFrame.getByRole('button', { name: 'Switch Target' })).toBeVisible()

  // verify closing trace viewer doesn't immediately auto-open it again
  await traceView.getByRole('button', { name: 'Close Trace Viewer' }).click()
  await expect(traceView).toBeHidden()
}

async function testViewport(page: Page) {
  await openExplorerItem(page, 'viewport')

  const traceView = page.getByTestId('trace-view')
  const traceSteps = traceView.getByTestId('trace-step-name')
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceView).toBeVisible()
  await traceSteps.getByText('Render viewport').click()
  await expect(traceFrame.locator('.viewport-pass')).toBeVisible()
}

async function testPseudoState(page: Page) {
  await openExplorerItem(page, 'pseudo-state')

  const traceView = page.getByTestId('trace-view')
  const traceSteps = traceView.getByTestId('trace-step-name')
  const traceFrame = traceView.frameLocator('iframe')

  await expect(traceView).toBeVisible()

  const pseudoOff = ['background-color', 'rgb(255, 200, 200)'] as const
  const pseudoOn = ['background-color', 'rgb(253, 224, 71)'] as const

  // trace view replays hover state at the time of snapshot
  await traceSteps.nth(0).click()
  await expect(traceFrame.getByText('Test hover 1')).toHaveCSS(...pseudoOn)
  await expect(traceFrame.getByText('Test hover 2')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(1).click()
  await expect(traceFrame.getByText('Test hover 1')).toHaveCSS(...pseudoOff)
  await expect(traceFrame.getByText('Test hover 2')).toHaveCSS(...pseudoOn)

  // trace view reacts to interaction during the replay
  // this is verified manually but seems flaky on playwright
  // maybe because it clicks inside shadow-dom inside iframe
  await expect(async () => {
    await traceFrame.getByText('Test hover 1').click()
    await expect(traceFrame.getByText('Test hover 1')).toHaveCSS(...pseudoOn)
  }).toPass()

  // focus
  await expect(traceFrame.locator('.test-focus')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(3).click()
  await expect(traceFrame.locator('.test-focus')).toHaveCSS(...pseudoOn)

  // focus-within
  await expect(traceFrame.locator('.test-focus-within')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(4).click()
  await expect(traceFrame.locator('.test-focus-within')).toHaveCSS(...pseudoOn)

  // active
  await expect(traceFrame.locator('.test-active')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(5).click()
  await expect(traceFrame.locator('.test-active')).toHaveCSS(...pseudoOn)

  // focus-visible
  await expect(traceFrame.locator('.test-focus-visible')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(7).click()
  await expect(traceFrame.locator('.test-focus-visible')).toHaveCSS(...pseudoOn)
}

async function testCssLink(page: Page) {
  await openExplorerItem(page, 'css-link')

  const traceView = page.getByTestId('trace-view')
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceView).toBeVisible()
  await expect(traceFrame.getByRole('button', { name: 'Linked CSS' })).toHaveCSS('color', 'rgb(50, 100, 255)')
}

async function testImage(page: Page) {
  await openExplorerItem(page, 'image')

  const traceView = page.getByTestId('trace-view')
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceView).toBeVisible()
  await expect(traceFrame.getByAltText('local trace asset')).not.toHaveJSProperty('naturalWidth', 0)
}

async function testScroll(page: Page) {
  await openExplorerItem(page, 'scroll')

  const traceView = page.getByTestId('trace-view')
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceView).toBeVisible()
  await expect(traceFrame.getByText('(0, 0)')).not.toBeInViewport()
  await expect(traceFrame.getByText('(300, 300)')).toBeInViewport()
}

async function testAttempts(page: Page) {
  await openExplorerItem(page, 'retried test')

  const traceView = page.getByTestId('trace-view')
  const traceFrame = traceView.frameLocator('iframe')

  await expect(traceView).toBeVisible()

  const traceOpenButtons = page.getByTestId('trace-open-button')
  await expect(traceOpenButtons).toHaveText([
    'Open trace viewer',
    'Open trace viewer Retry 1',
    'Open trace viewer Retry 2',
  ])

  await traceOpenButtons.nth(0).click()
  await expect(traceFrame.getByText('retryCount: 0')).toBeVisible()
  await expect(traceFrame.getByText('repeatCount: 0')).toBeVisible()

  await traceOpenButtons.nth(1).click()
  await expect(traceFrame.getByText('retryCount: 1')).toBeVisible()
  await expect(traceFrame.getByText('repeatCount: 0')).toBeVisible()

  await traceOpenButtons.nth(2).click()
  await expect(traceFrame.getByText('retryCount: 2')).toBeVisible()
  await expect(traceFrame.getByText('repeatCount: 0')).toBeVisible()
}
