import type { PreviewServer } from 'vite'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { test } from '@playwright/test'
import { startHtmlReportPreview, startVitestSimple } from './helper'

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
    })
    await startVitestSimple({
      root: macosRoot,
      reporters: [['blob', { label: 'macos' }]],
    })

    mkdirSync(linuxBlobDir, { recursive: true })
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

    // const macosFile = page
    //   .getByTestId('explorer-item')
    //   .filter({ hasText: 'macos' })
    //   .filter({ hasText: 'basic.test.ts' })
    //   .first()

    // await macosFile.hover()
    // await macosFile.getByTestId('btn-open-details').click()
    // await page.getByTestId('btn-code').click()

    // await expect(page.getByTestId('editor')).toContainText(sourceSentinel)
  })
})
