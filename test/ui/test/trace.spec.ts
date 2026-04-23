import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import assert from 'node:assert'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { preview } from 'vite'
import { startVitest } from 'vitest/node'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    vitest = await startVitest(
      'test',
      undefined,
      {
        root: './fixtures-trace',
        watch: true,
        ui: true,
        open: false,
      },
      {},
      { stdout, stderr },
    )
    const address = vitest.vite.httpServer?.address()
    assert(address && typeof address === 'object', 'Invalid server address')
    baseURL = `http://localhost:${address.port}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL)
    await testReady(page)
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
})

test.describe('html reporter', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    await startVitest(
      'test',
      undefined,
      {
        root: './fixtures-trace',
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
      {},
      { stdout, stderr },
    )
    previewServer = await preview({
      root: './fixtures-trace',
      build: { outDir: 'html' },
    })
    const address = previewServer.httpServer?.address()
    assert(address && typeof address === 'object', 'Invalid server address')
    baseURL = `http://localhost:${address.port}/`
  })

  test.afterAll(async () => {
    await previewServer.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL)
    await testReady(page)
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
})

async function testReady(page: Page) {
  const count = 6
  await expect.soft(page.getByTestId('tests-entry'))
    .toContainText(`${count} Pass 0 Fail ${count} Total`)
}

async function openExplorerItem(page: Page, name: string) {
  await page.getByTestId('explorer-item').and(page.getByLabel(name, { exact: true })).click()
}

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

  // verify snaphsot replay in iframe
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceFrame.getByRole('button', { name: 'Simple' })).toBeVisible()

  // verify selector highlight
  await expect(traceFrame.getByTestId('trace-view-highlight')).toBeVisible()
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
