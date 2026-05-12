import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { startVitestUi } from './helper'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let pageUrl: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root: './fixtures/main',
      watch: true,
      ui: true,
      open: false,
      api: {
        allowExec: false,
        allowWrite: false,
      },
      reporters: [],
    })
    vitest = server.vitest
    pageUrl = `${server.url}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('cannot execute files from the ui', async ({ page }) => {
    await page.goto(pageUrl)

    await expect(page.getByTestId('btn-run-all')).toBeDisabled()

    const item = page.getByTestId('explorer-item').nth(0)
    await item.hover()
    await expect(item.getByTestId('btn-run-test')).toBeDisabled()

    await page.getByPlaceholder('Search...').fill('snapshot')

    const snapshotItem = page.getByTestId('explorer-item').filter({ hasText: 'snapshot.test.ts' })
    await snapshotItem.hover()
    await expect(snapshotItem.getByTestId('btn-fix-snapshot')).not.toBeVisible()
  })

  test('cannot write files', async ({ page }) => {
    await page.goto(pageUrl)

    const item = page.getByTestId('explorer-item').nth(0)
    await item.hover()
    await item.getByTestId('btn-open-details').click()

    // TODO: harden assertion
    const editor = page.getByTestId('btn-code')
    await editor.click()
    await page.keyboard.type('\n// some comment')

    await expect(editor).not.toContainText('// some comment')
  })

  test('cross origin disallowed', async ({ page }, testInfo) => {
    const response = await page.goto('https://example.com/', { timeout: 5000 }).catch(() => null)

    testInfo.skip(!response, 'External resource is not available')

    // request html
    const htmlResult = await page.evaluate(async (pageUrl) => {
      try {
        const res = await fetch(pageUrl)
        return res.status
      }
      catch (e) {
        return e instanceof Error ? e.message : e
      }
    }, pageUrl)
    expect(htmlResult).toBe('Failed to fetch')

    // request websocket
    const wsResult = await page.evaluate(async (pageUrl) => {
      const ws = new WebSocket(new URL('/__vitest_api__', pageUrl))
      return new Promise((resolve) => {
        ws.addEventListener('open', () => {
          resolve('open')
        })
        ws.addEventListener('error', () => {
          resolve('error')
        })
      })
    }, pageUrl)
    expect(wsResult).toBe('error')
  })
})
