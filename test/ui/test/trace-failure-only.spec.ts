import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertTestCounts, openExplorerItem, startVitestUi } from './helper'

test.describe('ui failure-only trace', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root: './fixtures/trace-failure-only',
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

  test('failed test', async ({ page }) => {
    await openExplorerItem(page, 'basic')

    const traceView = page.getByTestId('trace-view')
    await expect(traceView).toBeVisible()

    const traceSteps = traceView.getByTestId('trace-step-name')
    await expect(traceSteps).toHaveText([
      'toHaveTextContent',
      'toHaveAccessibleName',
      'toHaveTextContent [ERROR]',
      'test finished',
    ])

    await traceSteps.nth(1).click()
    await expect(traceView.getByText('No DOM snapshot captured for this trace step')).toBeVisible()

    await traceSteps.nth(3).click()
    const traceFrame = traceView.frameLocator('iframe')
    await expect(traceFrame.getByRole('button', { name: 'hello' })).toBeVisible()
  })

  test('passed test', async ({ page }) => {
    await openExplorerItem(page, 'pass')

    const traceView = page.getByTestId('trace-view')
    await expect(traceView).toBeVisible()
    await expect(traceView.getByText('No trace found')).toBeVisible()
  })
})
