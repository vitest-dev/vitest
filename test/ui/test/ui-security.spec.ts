import type { Vitest } from 'vitest/node'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { startVitest } from 'vitest/node'

const port = 9002
const pageUrl = `http://localhost:${port}/__vitest__/`

test.describe('ui', () => {
  let vitest: Vitest | undefined

  test.beforeAll(async () => {
    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    vitest = await startVitest('test', [], {
      watch: true,
      ui: true,
      open: false,
      api: {
        port,
        allowExec: false,
        allowWrite: false,
      },
      reporters: [],
    }, {}, {
      stdout,
      stderr,
    })
    expect(vitest).toBeDefined()
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

    await page.getByText('Code').click()

    const editor = page.getByTestId('btn-code')
    await expect(editor).toBeVisible()

    await editor.click()
    await page.keyboard.type('\n// some comment')

    await expect(editor).not.toContainText('// some comment')
  })
})
