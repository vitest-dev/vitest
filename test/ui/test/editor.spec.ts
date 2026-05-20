import type { Vitest } from 'vitest/node'
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { assertTestCounts, getExplorerItem, startVitestUi } from './helper'

test.describe('editor', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  const root = path.join(import.meta.dirname, '../fixtures/editor')
  const testFile = path.join(root, 'basic.test.ts')
  const testFileContent = fs.readFileSync(testFile, 'utf-8')

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root,
      watch: true,
      ui: true,
      open: false,
      reporters: [],
    })
    vitest = server.vitest
    baseURL = `${server.url}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
    fs.writeFileSync(testFile, testFileContent, 'utf-8')
  })

  test('can edit', async ({ page }) => {
    await page.goto(baseURL)

    await assertTestCounts(page, { pass: 1, fail: 0 })

    const item = getExplorerItem(page, 'test-to-edit')
    const editor = page.getByTestId('editor')

    // initially pass
    await expect(item.getByTestId('status-icon-pass')).toBeVisible()

    // open editor
    await item.click()
    await page.getByTestId('btn-code').click()
    await expect(editor).toContainText('.toBe(2)')

    // edit to fail test
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+A`)
    await page.keyboard.type(testFileContent.replace('toBe(2)', 'toBe(3)'))
    await page.keyboard.press(`${modifier}+S`)

    // verify failed
    await expect(item.getByTestId('status-icon-fail')).toBeVisible()
    await expect(editor).toContainText('toBe(3)')
    await expect(editor).toContainText('AssertionError: expected 2 to be 3')

    // edit to fix test
    await page.keyboard.press(`${modifier}+A`)
    await page.keyboard.type(testFileContent)
    await page.keyboard.press(`${modifier}+S`)

    // verify fixed
    await expect(item.getByTestId('status-icon-pass')).toBeVisible()
    await expect(editor).toContainText('.toBe(2)')
    await expect(editor).not.toContainText('AssertionError')
  })
})
