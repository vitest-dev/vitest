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
})

async function testReady(page: Page) {
  await expect.soft(page.getByTestId('tests-entry'))
    .toContainText('5 Pass 0 Fail 5 Total')
}

async function testBasic(page: Page) {
  // selecting test case opens trace viewer
  const traceView = page.getByTestId('trace-view')
  await expect(traceView).toBeHidden()
  await page.getByTestId('explorer-item').getByText('simple').click()
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
  await page.getByTestId('explorer-item').getByText('viewport').click()

  const traceView = page.getByTestId('trace-view')
  const traceSteps = traceView.getByTestId('trace-step-name')
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceView).toBeVisible()
  await traceSteps.getByText('Render viewport').click()
  await expect(traceFrame.locator('.viewport-pass')).toBeVisible()
}

async function testPseudoState(page: Page) {
  await page.getByTestId('explorer-item').getByText('pseudo-state').click()

  const traceView = page.getByTestId('trace-view')
  const traceSteps = traceView.getByTestId('trace-step-name')
  const traceFrame = traceView.frameLocator('iframe')

  await expect(traceView).toBeVisible()

  const pseudoOff = ['background-color', 'rgb(255, 200, 200)'] as const
  const pseudoOn = ['background-color', 'rgb(253, 224, 71)'] as const

  // trace view replays hover state at the time of snapshot
  await traceSteps.nth(0).click()
  await expect(traceFrame.getByText('First pseudo state')).toHaveCSS(...pseudoOn)
  await expect(traceFrame.getByText('Second pseudo state')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(1).click()
  await expect(traceFrame.getByText('First pseudo state')).toHaveCSS(...pseudoOff)
  await expect(traceFrame.getByText('Second pseudo state')).toHaveCSS(...pseudoOn)

  // trace view reacts to interaction during the replay
  // this is verified manually but seems flaky on playwright
  // maybe because it clicks inside shadow-dom inside iframe
  await expect(async () => {
    await traceFrame.getByText('First pseudo state').click()
    await expect(traceFrame.getByText('First pseudo state')).toHaveCSS(...pseudoOn)
  }).toPass()

  // focus
  await expect(traceFrame.getByLabel('Focused pseudo state')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(3).click()
  await expect(traceFrame.getByLabel('Focused pseudo state')).toHaveCSS(...pseudoOn)

  // focus-within
  await expect(traceFrame.locator('.trace-pseudo-within')).toHaveCSS(...pseudoOff)
  await traceSteps.nth(4).click()
  await expect(traceFrame.locator('.trace-pseudo-within')).toHaveCSS(...pseudoOn)
}

async function testCssLink(page: Page) {
  await page.getByTestId('explorer-item').getByText('css-link').click()

  const traceView = page.getByTestId('trace-view')
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceView).toBeVisible()
  await expect(traceFrame.getByRole('button', { name: 'Linked CSS' })).toHaveCSS('color', 'rgb(50, 100, 255)')
}

async function testImage(page: Page) {
  await page.getByTestId('explorer-item').getByText('image').click()

  const traceView = page.getByTestId('trace-view')
  const traceFrame = traceView.frameLocator('iframe')
  await expect(traceView).toBeVisible()
  await expect(traceFrame.getByAltText('local trace asset')).not.toHaveJSProperty('naturalWidth', 0)
}
