import type { PreviewServer } from 'vite'
import { expect, test } from '@playwright/test'
import { assertDownloadAttachment, assertTestCounts, openExplorerItem, startHtmlReportPreview } from './helper'

test.describe('html singleFile', () => {
  let previewServer: PreviewServer
  let baseURL: string

  test.beforeAll(async () => {
    const root = './fixtures/single-file'
    const server = await startHtmlReportPreview(
      {
        root,
        run: true,
      },
      {
        root,
        build: { outDir: 'html' },
      },
    )
    previewServer = server.previewServer
    baseURL = `${server.url}/`
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
    await assertTestCounts(page, { pass: 2, fail: 1 })

    // test inlined attachments
    await openExplorerItem(page, 'annotation')
    await assertDownloadAttachment(page, {
      name: 'annotation-body',
      suggestedFilename: 'annotation-body.txt',
      content: 'test-body-content',
    })
    await assertDownloadAttachment(page, {
      name: 'annotation-path',
      suggestedFilename: 'annotation-path.txt',
      content: 'test-path-content\n',
    })

    // validate index.html is the only origin request
    expect(requestUrls).toEqual([baseURL])
  })
})
