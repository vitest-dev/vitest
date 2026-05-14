import type { PreviewServer } from 'vite'
import { readdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { getAnnotation, getExplorerItem, startHtmlReportPreview, startVitestSimple } from './helper'

test.describe('html reporter', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    // Simulate CI uploads blobs from platform-specific jobs and merges them on
    // a Linux job, so the merged report can reference source paths that do not
    // exist on the machine generating the HTML report.

    const baseDir = path.join(import.meta.dirname, '../fixtures/merge-reports')
    const linuxRoot = path.join(baseDir, 'linux')
    const macosRoot = path.join(baseDir, 'macos')
    const linuxBlobDir = path.join(linuxRoot, '.vitest/blob')
    const macosBlobDir = path.join(macosRoot, '.vitest/blob')

    rmSync(linuxBlobDir, { force: true, recursive: true })
    rmSync(macosBlobDir, { force: true, recursive: true })

    await startVitestSimple({
      root: linuxRoot,
      reporters: [['blob', { label: 'linux' }]],
      env: { TEST_LABEL: 'linux' },
    })
    await startVitestSimple({
      root: macosRoot,
      reporters: [['blob', { label: 'macos' }]],
      env: { TEST_LABEL: 'macos' },
    })

    for (const filename of readdirSync(macosBlobDir)) {
      renameSync(path.join(macosBlobDir, filename), path.join(linuxBlobDir, filename))
    }

    const server = await startHtmlReportPreview(
      {
        root: linuxRoot,
        mergeReports: linuxBlobDir,
        reporters: 'html',
      },
      {
        root: linuxRoot,
        build: { outDir: 'html' },
      },
    )

    previewServer = server.previewServer
    baseURL = `${server.url}/`
  })

  test.afterAll(async () => {
    await previewServer?.close()
  })

  test('code from different root is available', async ({ page }) => {
    await page.goto(baseURL)

    const item1 = getExplorerItem(page, 'basic.test.ts').filter({ hasText: 'linux' })
    const item2 = getExplorerItem(page, 'basic.test.ts').filter({ hasText: 'macos' })
    const editorButton = page.getByTestId('btn-code')
    const editor = page.getByTestId('editor')

    await item1.hover()
    await item1.getByTestId('btn-open-details').click()
    await editorButton.click()
    await expect(editor).toContainText(`test('ok'`)
    await expect(getAnnotation(editor, 'test-linux')).toBeVisible()

    await item2.hover()
    await item2.getByTestId('btn-open-details').click()
    await editorButton.click()
    await expect(editor).toContainText(`test('ok'`)
    await expect(getAnnotation(editor, 'test-macos')).toBeVisible()
  })
})
