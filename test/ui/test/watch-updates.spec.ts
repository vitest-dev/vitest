import type { Vitest } from 'vitest/node'
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { assertTestCounts, getExplorerItem, startVitestUi } from './helper'

// Regression tests for explorer tree reconciliation on watch re-runs:
// - removing a test from a file must drop the stale test node (no ghost node)
// - changing a task type must replace the incompatible node with the reused id
// - deleting a test file must drop the stale file node (onTestRemoved forwarding)
test.describe('explorer watch updates', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  const root = path.join(import.meta.dirname, '../fixtures/watch-updates')
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

  test('prunes stale tasks and removes deleted files', async ({ page }) => {
    await page.goto(baseURL)

    // initial: 3 tests in basic.test.ts + 1 test in second.test.ts
    await assertTestCounts(page, { pass: 4, fail: 0 })
    await expect(getExplorerItem(page, 'reconcile-keep')).toBeVisible()
    await expect(getExplorerItem(page, 'reconcile-type-suite')).toBeVisible()
    await expect(getExplorerItem(page, 'reconcile-remove-me')).toBeVisible()
    await expect(getExplorerItem(page, 'reconcile-second-file')).toBeVisible()

    // select then remove a single test from basic.test.ts and let watch mode re-run
    await getExplorerItem(page, 'reconcile-remove-me').click()
    await expect(page.getByTestId('file-detail')).toContainText('reconcile-remove-me')
    fs.writeFileSync(
      basicFile,
      basicContent.replace(
        /\/\/ TEST REMOVE START[\s\S]*?\/\/ TEST REMOVE END\n/,
        '',
      ),
      'utf-8',
    )

    // the removed test node must disappear (no ghost node), the kept one stays
    await expect(getExplorerItem(page, 'reconcile-remove-me')).toHaveCount(0)
    await expect(page.getByTestId('file-detail')).not.toContainText('reconcile-remove-me')
    await expect(getExplorerItem(page, 'reconcile-keep')).toBeVisible()
    await page.getByRole('button', { name: 'Show dashboard' }).click()
    await assertTestCounts(page, { pass: 3, fail: 0 })

    // replace a suite with a test at the same position-based id
    fs.writeFileSync(
      basicFile,
      fs.readFileSync(basicFile, 'utf-8').replace(
        /\/\/ TEST TASK TYPE CHANGE START[\s\S]*?\/\/ TEST TASK TYPE CHANGE END\n/,
        `// TEST TASK TYPE CHANGE START
test('reconcile-type-test', () => {
  expect(3 + 3).toBe(6)
})
// TEST TASK TYPE CHANGE END
`,
      ),
      'utf-8',
    )

    await expect(getExplorerItem(page, 'reconcile-type-suite')).toHaveCount(0)
    await expect(getExplorerItem(page, 'reconcile-type-test')).toBeVisible()
    await assertTestCounts(page, { pass: 3, fail: 0 })

    // select then delete an entire test file and let the watcher emit onTestRemoved
    await getExplorerItem(page, 'reconcile-second-file').click()
    await expect(page.getByTestId('file-detail')).toContainText('reconcile-second-file')
    fs.rmSync(secondFile)

    // the deleted file's test node must disappear (no ghost file node)
    await expect(getExplorerItem(page, 'reconcile-second-file')).toHaveCount(0)
    await expect(page.getByTestId('file-detail')).toHaveCount(0)
    await expect(getExplorerItem(page, 'reconcile-keep')).toBeVisible()
    await page.getByRole('button', { name: 'Show dashboard' }).click()
    await assertTestCounts(page, { pass: 2, fail: 0 })
  })
})
