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
    const editorTabButton = page.getByTestId('btn-code')
    const editorImpl = page.getByTestId('editor').locator('.CodeMirror')
    const editorHasFocus = () => editorImpl.evaluate(e => (e as any).CodeMirror.hasFocus())

    // initially pass
    await expect(item.getByTestId('status-icon-pass')).toBeVisible()

    // open editor
    await item.click()
    await editorTabButton.click()
    await expect(editor).toContainText('.toBe(2)')

    // edit to fail test
    await editorImpl.click()
    await expect.poll(() => editorHasFocus()).toBe(true)
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type(testFileContent.replace('toBe(2)', 'toBe(3)'))
    await expect(editorTabButton).toHaveText('* Code')
    await page.keyboard.press('ControlOrMeta+S')

    // verify failed
    await expect(item.getByTestId('status-icon-fail')).toBeVisible()
    await expect(editor).toContainText('toBe(3)')
    await expect(editor).toContainText('AssertionError: expected 2 to be 3')
    await expect(editorTabButton).toHaveText('Code')

    // edit to fix test
    await editorImpl.click()
    await expect.poll(() => editorHasFocus()).toBe(true)
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type(testFileContent)
    await expect(editorTabButton).toHaveText('* Code')
    await page.keyboard.press('ControlOrMeta+S')

    // verify fixed
    await expect(item.getByTestId('status-icon-pass')).toBeVisible()
    await expect(editor).toContainText('.toBe(2)')
    await expect(editor).not.toContainText('AssertionError')
    await expect(editorTabButton).toHaveText('Code')
  })
})
