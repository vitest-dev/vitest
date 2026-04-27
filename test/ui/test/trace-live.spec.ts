import type { Vitest } from 'vitest/node'
import assert from 'node:assert'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { startVitest } from 'vitest/node'

test.describe('trace-live', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    vitest = await startVitest(
      'test',
      undefined,
      {
        root: './fixtures-trace-live',
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

  test('trace view stays visible during re-run and auto-reloads after', async ({ page }) => {
    await page.goto(baseURL)

    // wait for first run to complete
    await expect(page.getByTestId('tests-entry')).toContainText('1 Pass 0 Fail 1 Total', { timeout: 15_000 })

    // open trace view by clicking the test in the explorer
    await page.getByTestId('explorer-item').and(page.getByLabel('slow steps', { exact: true })).click()

    const traceView = page.getByTestId('trace-view')
    await expect(traceView).toBeVisible()

    const traceSteps = traceView.getByTestId('trace-step-name')
    await expect(traceSteps.getByText('before sleep')).toBeVisible()
    await expect(traceSteps.getByText('after sleep')).toBeVisible()

    // trigger a re-run without awaiting so we can assert mid-run
    const rerunPromise = vitest!.rerunFiles()

    // while the slow test is still running, the trace view must stay visible
    // (previous run entries are kept until the new run finishes)
    await expect(page.getByText('RUNNING')).toBeVisible()
    await expect(traceView).toBeVisible()
    await expect(traceSteps.getByText('before sleep')).toBeVisible()

    // after re-run completes the trace view must auto-reload with new entries
    // (driven by `watch(finished, ...)` in trace-view.ts)
    await rerunPromise
    await expect(traceView).toBeVisible({ timeout: 10_000 })
    await expect(traceSteps.getByText('before sleep')).toBeVisible({ timeout: 10_000 })
    await expect(traceSteps.getByText('after sleep')).toBeVisible({ timeout: 10_000 })
  })
})
