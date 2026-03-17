import type { PreviewServer } from 'vite'
import { readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { preview } from 'vite'
import { startVitest } from 'vitest/node'

const port = 9001
const pageUrl = `http://localhost:${port}/custom/base/`

test.describe('html report', () => {
  let previewServer: PreviewServer

  test.beforeAll(async () => {
    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    // generate vitest html report
    await startVitest(
      'test',
      [],
      {
        run: true,
        reporters: 'html',
        coverage: {
          enabled: true,
        },
      },
      {},
      {
        stdout,
        stderr,
      },
    )

    // run vite preview server
    previewServer = await preview({
      base: '/custom/base/',
      build: { outDir: 'html' },
      preview: { port, strictPort: true },
    })
  })

  test.afterAll(async () => {
    await previewServer?.close()
  })

  test('basic', async ({ page }) => {
    const pageErrors: unknown[] = []
    page.on('pageerror', error => pageErrors.push(error))

    await page.goto(pageUrl)

    // dashboard
    await expect(page.getByTestId('pass-entry')).toContainText('16 Pass')
    await expect(page.getByTestId('fail-entry')).toContainText('2 Fail')
    await expect(page.getByTestId('total-entry')).toContainText('18 Total')

    // unhandled errors
    await expect(page.getByTestId('unhandled-errors')).toContainText(
      'Vitest caught 2 errors during the test run. This might cause false positive tests. '
      + 'Resolve unhandled errors to make sure your tests are not affected.',
    )

    await expect(page.getByTestId('unhandled-errors-details')).toContainText('Error: error')
    await expect(page.getByTestId('unhandled-errors-details')).toContainText('Unknown Error: 1')

    // report
    const sample = page.getByTestId('results-panel').getByLabel('sample.test.ts')
    await sample.hover()
    await sample.getByTestId('btn-open-details').click({ force: true })
    await page.getByText('All tests passed in this file').click()

    // graph tab
    await page.getByTestId('btn-graph').click()
    await expect(page.locator('[data-testid=graph] text')).toContainText('sample.test.ts')

    // console tab
    await page.getByTestId('btn-console').click()
    await expect(page.getByTestId('console')).toContainText('log test')

    expect(pageErrors).toEqual([])
  })

  test('coverage', async ({ page }) => {
    await page.goto(pageUrl)
    await page.getByLabel('Show coverage').click()
    await page.frameLocator('#vitest-ui-coverage').getByRole('heading', { name: 'All files' }).click()
  })

  test('error', async ({ page }) => {
    await page.goto(pageUrl)
    const sample = page.getByTestId('results-panel').getByLabel('fixtures/error.test.ts')
    await sample.hover()
    await sample.getByTestId('btn-open-details').click({ force: true })
    await expect(page.getByTestId('diff')).toContainText('- Expected + Received + <style>* {border: 2px solid green};</style>')
  })

  test('annotations in the report tab', async ({ page }) => {
    await page.goto(pageUrl)

    await test.step('annotated test', async () => {
      const item = page.getByLabel('annotated test')
      await item.click({ force: true })
      await page.getByTestId('btn-report').click({ force: true })

      const annotations = page.getByRole('note')
      await expect(annotations).toHaveCount(2)

      await expect(annotations.first()).toContainText('hello world')
      await expect(annotations.first()).toContainText('notice')
      await expect(annotations.first()).toContainText('fixtures/annotated.test.ts:4:9')

      await expect(annotations.last()).toContainText('second annotation')
      await expect(annotations.last()).toContainText('notice')
      await expect(annotations.last()).toContainText('fixtures/annotated.test.ts:5:9')
    })

    await test.step('annotated typed test', async () => {
      const item = page.getByLabel('annotated typed test')
      await item.click({ force: true })
      await page.getByTestId('btn-report').click({ force: true })

      const annotation = page.getByRole('note')
      await expect(annotation).toHaveCount(1)

      await expect(annotation).toContainText('beware!')
      await expect(annotation).toContainText('warning')
      await expect(annotation).toContainText('fixtures/annotated.test.ts:9:9')
    })

    await test.step('annotated file test', async () => {
      const item = page.getByLabel('annotated file test')
      await item.click({ force: true })
      await page.getByTestId('btn-report').click({ force: true })

      const annotation = page.getByRole('note')
      await expect(annotation).toHaveCount(1)

      await expect(annotation).toContainText('file annotation')
      await expect(annotation).toContainText('notice')
      await expect(annotation).toContainText('fixtures/annotated.test.ts:13:9')
      await expect(annotation.getByRole('link')).toHaveAttribute('href', /data\/\w+/)
    })

    await test.step('annotated image test', async () => {
      const item = page.getByLabel('annotated image test')
      await item.click({ force: true })
      await page.getByTestId('btn-report').click({ force: true })

      const annotation = page.getByRole('note')
      await expect(annotation).toHaveCount(1)

      await expect(annotation).toContainText('image annotation')
      await expect(annotation).toContainText('notice')
      await expect(annotation).toContainText('fixtures/annotated.test.ts:19:9')
      await expect(annotation.getByRole('link')).toHaveAttribute('href', /data\/\w+/)
      const img = annotation.getByRole('img')
      await expect(img).toHaveAttribute('src', /data\/\w+/)
      await expect(img).not.toHaveJSProperty('naturalWidth', 0)
    })

    await test.step('annotated with body', async () => {
      const item = page.getByLabel('annotated with body')
      await item.click({ force: true })
      await page.getByTestId('btn-report').click({ force: true })

      const annotation = page.getByRole('note')
      await expect(annotation).toHaveCount(1)

      await expect(annotation).toContainText('body annotation')
      await expect(annotation).toContainText('notice')
      await expect(annotation).toContainText('fixtures/annotated.test.ts:25:9')

      const downloadPromise = page.waitForEvent('download')
      await annotation.getByRole('link').click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('body-annotation.md')
      const downloadPath = await download.path()
      const content = readFileSync(downloadPath, 'utf-8')
      expect(content).toBe('Hello **markdown**')
    })
  })

  test('annotations', async ({ page }) => {
    await page.goto(pageUrl)
    const item = page.getByLabel('fixtures/annotated.test.ts')
    await item.hover()
    await item.getByTestId('btn-open-details').click({ force: true })
    await page.getByTestId('btn-code').click({ force: true })

    const annotations = page.getByRole('note')
    await expect(annotations).toHaveCount(6)

    await expect(annotations.first()).toHaveText('notice: hello world')
    await expect(annotations.nth(1)).toHaveText('notice: second annotation')
    await expect(annotations.nth(2)).toHaveText('warning: beware!')
    await expect(annotations.nth(3)).toHaveText(/notice: file annotation/)
    await expect(annotations.nth(4)).toHaveText('notice: image annotation')
    await expect(annotations.nth(5)).toHaveText(/notice: body annotation/)

    await expect(annotations.nth(3).getByRole('link')).toHaveAttribute('href', /data\/\w+/)
    await expect(annotations.nth(4).getByRole('link')).toHaveAttribute('href', /data\/\w+/)
    await expect(annotations.nth(5).getByRole('link')).toHaveAttribute('href', /^data:text\/markdown;base64,/)
  })

  test('tags filter', async ({ page }) => {
    await page.goto(pageUrl)

    await page.getByPlaceholder('Search...').fill('tag:db')

    // only one test with the tag "db"
    await expect(page.getByText('PASS (1)')).toBeVisible()
    await expect(page.getByTestId('explorer-item').filter({ hasText: 'has tags' })).toBeVisible()

    await page.getByPlaceholder('Search...').fill('tag:db && !flaky')
    await expect(page.getByText('No matched test')).toBeVisible()

    await page.getByPlaceholder('Search...').fill('tag:unknown')
    await expect(page.getByText('The tag pattern "unknown" is not defined in the configuration')).toBeVisible()
  })

  test('visual regression in the report tab', async ({ page }) => {
    await page.goto(pageUrl)

    await test.step('attachments get processed', async () => {
      const item = page.getByLabel('visual regression test')
      await item.click({ force: true })
      await page.getByTestId('btn-report').click({ force: true })

      const artifact = page.getByRole('note')
      await expect(artifact).toHaveCount(1)

      await expect(artifact.getByRole('heading')).toContainText('Visual Regression')
      await expect(artifact).toContainText('fixtures-browser/visual-regression.test.ts:13:3')
      await expect(artifact.getByRole('tablist')).toHaveText('Reference')
      await expect(artifact.getByRole('tabpanel').getByRole('link')).toHaveAttribute('href', /data\/\w+\.png/)
      const vrImg = artifact.getByRole('tabpanel').getByRole('img')
      await expect(vrImg).toHaveAttribute('src', /data\/\w+\.png/)
      await expect(vrImg).not.toHaveJSProperty('naturalWidth', 0)
    })
  })
})
