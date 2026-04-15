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

  test('basic', async ({ page }) => {
    await page.goto(baseURL)
    await testBasic(page)
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

  test('basic', async ({ page }) => {
    await page.goto(baseURL)
    await testBasic(page)
  })
})

async function testBasic(page: Page) {
  await expect.soft(page.getByTestId('tests-entry')).toContainText('11 Pass 2 Fail 13 Total')

  // selecting test case opens trace viewer
  const traceView = page.getByTestId('trace-view')
  await expect(traceView).toBeHidden()
  await page.getByText('locator.mark').click()
  await expect(traceView).toBeVisible()

  // selecting steps should open source code view
  await expect(page.getByTestId('btn-report')).toContainClass('tab-button-active')
  await traceView.getByRole('button', { name: 'button rendered - locator' }).click()
  await expect(page.getByTestId('btn-code')).toContainClass('tab-button-active')

  // verify snaphsot replay in iframe
  const traceViewFrame = traceView.frameLocator('iframe')
  await expect(traceViewFrame.getByRole('button', { name: 'Hello' })).toBeVisible()

  // verify selector highlight
  await expect(traceViewFrame.getByTestId('trace-view-highlight')).toBeVisible()
}
