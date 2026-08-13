import type { Vitest } from 'vitest/node'
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { assertTestCounts, getExplorerItem, startVitestUi } from './helper'

// TODO: rename

// Regression tests for explorer tree reconciliation on watch re-runs:
// - removing a test from a file must drop the stale test node (no ghost node)
// - deleting a test file must drop the stale file node (onTestRemoved forwarding)
test.describe('explorer reconcile', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  const root = path.join(import.meta.dirname, '../fixtures/reconcile')
  const basicFile = path.join(root, 'basic.test.ts')
  const secondFile = path.join(root, 'second.test.ts')
  const basicContent = fs.readFileSync(basicFile, 'utf-8')
  const secondContent = fs.readFileSync(secondFile, 'utf-8')

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root,
      watch: true,
      ui: true,
      open: false,
      reporters: [],
    })
    vitest = server.vitest
    baseURL = server.url
  })

  test.afterAll(async () => {
    await vitest?.close()
    fs.writeFileSync(basicFile, basicContent, 'utf-8')
    fs.writeFileSync(secondFile, secondContent, 'utf-8')
  })

  test('reconciles removed tests and deleted files', async ({ page }) => {
    await page.goto(baseURL)

    // initial: 2 tests in basic.test.ts + 1 test in second.test.ts
    await assertTestCounts(page, { pass: 3, fail: 0 })
    await expect(getExplorerItem(page, 'reconcile-keep')).toBeVisible()
    await expect(getExplorerItem(page, 'reconcile-remove-me')).toBeVisible()
    await expect(getExplorerItem(page, 'reconcile-second-file')).toBeVisible()

    // remove a single test from basic.test.ts and let watch mode re-run
    fs.writeFileSync(
      basicFile,
      basicContent.replace(
        /test\('reconcile-remove-me'[\s\S]*?\}\)\n/,
        '',
      ),
      'utf-8',
    )

    // the removed test node must disappear (no ghost node), the kept one stays
    await expect(getExplorerItem(page, 'reconcile-remove-me')).toHaveCount(0)
    await expect(getExplorerItem(page, 'reconcile-keep')).toBeVisible()
    await assertTestCounts(page, { pass: 2, fail: 0 })

    // delete an entire test file and let the watcher emit onTestRemoved
    fs.rmSync(secondFile)

    // the deleted file's test node must disappear (no ghost file node)
    await expect(getExplorerItem(page, 'reconcile-second-file')).toHaveCount(0)
    await expect(getExplorerItem(page, 'reconcile-keep')).toBeVisible()
    await assertTestCounts(page, { pass: 1, fail: 0 })
  })
})
