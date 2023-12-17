import { expect, test } from '@playwright/test'
import { execa } from 'execa'
import type { PreviewServer } from 'vite'
import { preview } from 'vite'

const port = 9001
const pageUrl = `http://localhost:${port}/`

test.describe('html report', () => {
  let previewServer: PreviewServer

  test.beforeAll(async () => {
    // generate vitest html report
    await execa('vitest', [
      'run',
      '--reporter=html',
    ], {
      // stdio: "inherit",
    })

    previewServer = await preview({ build: { outDir: 'html' }, preview: { port, strictPort: true } })
  })

  test.afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      previewServer.httpServer.close((err) => {
        err ? reject(err) : resolve()
      })
    })
  })

  test('basic', async ({ page }) => {
    const pageErrors: unknown[] = []
    page.on('pageerror', error => pageErrors.push(error))

    await page.goto(pageUrl)

    // dashbaord
    await expect(page.locator('[aria-labelledby=tests]')).toContainText('1 Pass 0 Fail 1 Total')

    // report
    await page.getByText('sample.test.ts').click()
    await page.getByText('All tests passed in this file').click()
    await expect(page.getByTestId('filenames')).toContainText('sample.test.ts')

    // graph tab
    await page.getByTestId('btn-graph').click()
    await expect(page.locator('[data-testid=graph] text')).toContainText('sample.test.ts')

    // console tab
    await page.getByTestId('btn-console').click()
    await expect(page.getByTestId('console')).toContainText('log test')

    expect(pageErrors).toEqual([])
  })
})
