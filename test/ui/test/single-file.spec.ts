import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { preview } from 'vite'
import { startVitest } from 'vitest/node'

test.describe('html singleFile', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    const root = './fixtures-single-file'
    await startVitest(
      'test',
      undefined,
      {
        root,
        run: true,
      },
      {},
      { stdout, stderr },
    )
    previewServer = await preview({
      root,
      build: { outDir: 'html' },
    })
    const address = previewServer.httpServer?.address()
    assert(address && typeof address === 'object', 'Invalid server address')
    baseURL = `http://localhost:${address.port}/`
  })

  test.afterAll(async () => {
    await previewServer.close()
  })

  test('basic', async ({ page }) => {
    const requestUrls: string[] = []
    const IGNORED_URLS = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/']
    page.on('request', (request) => {
      const url = request.url()
      if (!IGNORED_URLS.some(ignored => url.startsWith(ignored))) {
        requestUrls.push(url)
      }
    })

    await page.goto(baseURL)
    await assetTestCount(page, { pass: 2, fail: 1 })

    await openExplorerItem(page, 'annotation')
    await downloadAnnotationAttachment(page, 'annotation-body', 'test-body-content')
    await downloadAnnotationAttachment(page, 'annotation-path', 'test-path-content\n')

    // validate index.html is the only origin request
    expect(requestUrls).toEqual([baseURL])
  })
})

async function assetTestCount(page: Page, options: { pass: number; fail: number }) {
  const total = options.pass + options.fail
  await expect.soft(page.getByTestId('tests-entry'))
    .toContainText(`${options.pass} Pass ${options.fail} Fail ${total} Total`)
}

async function openExplorerItem(page: Page, name: string) {
  await page.getByTestId('explorer-item').and(page.getByLabel(name, { exact: true })).click()
}

async function downloadAnnotationAttachment(page: Page, name: string, expectedContent: string) {
  const annotation = page.getByRole('note').filter({ hasText: name })
  const downloadPromise = page.waitForEvent('download')
  await annotation.getByRole('link').click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  expect(readFileSync(downloadPath, 'utf-8')).toBe(expectedContent)
}
