import type { PreviewServer } from 'vite'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { preview } from 'vite'
import { startVitest } from 'vitest/node'

const port = 9001
const pageUrl = `http://localhost:${port}/`

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
          reportsDirectory: 'html/coverage',
          reporter: ['html'],
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
      build: { outDir: 'html' },
      preview: { port, strictPort: true },
    })
  })

  test.afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      // if there is no preview server, `startVitest` failed already
      if (!previewServer) {
        resolve()
        return
      }
      previewServer.httpServer.close((err) => {
        if (err) {
          reject(err)
        }
        else {
          resolve()
        }
      })
    })
  })

  test('basic', async ({ page }) => {
    const pageErrors: unknown[] = []
    page.on('pageerror', error => pageErrors.push(error))

    await page.goto(pageUrl)

    // dashboard
    await expect(page.locator('[aria-labelledby=tests]')).toContainText('13 Pass 1 Fail 14 Total')

    // unhandled errors
    await expect(page.getByTestId('unhandled-errors')).toContainText(
      'Vitest caught 2 errors during the test run. This might cause false positive tests. '
      + 'Resolve unhandled errors to make sure your tests are not affected.',
    )

    await expect(page.getByTestId('unhandled-errors-details')).toContainText('Error: error')
    await expect(page.getByTestId('unhandled-errors-details')).toContainText('Unknown Error: 1')

    // report
    const sample = page.getByTestId('details-panel').getByLabel('sample.test.ts')
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
    const sample = page.getByTestId('details-panel').getByLabel('fixtures/error.test.ts')
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
      await expect(annotation.getByRole('img')).toHaveAttribute('src', /data\/\w+/)
    })
  })

  test('annotations', async ({ page }) => {
    await page.goto(pageUrl)
    const item = page.getByLabel('fixtures/annotated.test.ts')
    await item.hover()
    await item.getByTestId('btn-open-details').click({ force: true })
    await page.getByTestId('btn-code').click({ force: true })

    const annotations = page.getByRole('note')
    await expect(annotations).toHaveCount(5)

    await expect(annotations.first()).toHaveText('notice: hello world')
    await expect(annotations.nth(1)).toHaveText('notice: second annotation')
    await expect(annotations.nth(2)).toHaveText('warning: beware!')
    await expect(annotations.nth(3)).toHaveText(/notice: file annotation/)
    await expect(annotations.nth(4)).toHaveText('notice: image annotation')

    await expect(annotations.last().getByRole('link')).toHaveAttribute('href', /data\/\w+/)
    await expect(annotations.nth(3).getByRole('link')).toHaveAttribute('href', /data\/\w+/)
  })
})
