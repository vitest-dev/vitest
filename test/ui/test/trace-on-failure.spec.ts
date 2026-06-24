import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertTestCounts, openExplorerItem, startVitestUi } from './helper'

test.describe('ui on-failure snapshots', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    const root = './fixtures/trace-on-failure'
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
    await assertTestCounts(page, { pass: 0, fail: 1 })
  })

  test('basic', async ({ page }) => {
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

    await traceSteps.nth(2).click()
    const traceFrame = traceView.frameLocator('iframe')
    await expect(traceFrame.getByRole('button', { name: 'hello' })).toBeVisible()

    await traceSteps.nth(1).click()
    await expect(traceView.getByText('No DOM snapshot captured for this trace step')).toBeVisible()
  })
})
