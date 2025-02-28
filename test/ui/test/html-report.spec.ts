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
    await expect(page.locator('[aria-labelledby=tests]')).toContainText('8 Pass 1 Fail 9 Total')

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
})
