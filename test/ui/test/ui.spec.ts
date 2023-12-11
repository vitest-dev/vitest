import { expect, test } from '@playwright/test'
import type { ExecaChildProcess } from 'execa'
import { execa } from 'execa'

const port = 9000
const pageUrl = `http://localhost:${port}/__vitest__/`

test.describe('ui', () => {
  let subProcess: ExecaChildProcess

  test.beforeAll(async () => {
    // start vitest ui server
    subProcess = execa('vitest', [
      '--ui',
      '--watch',
      '--open=false',
      `--api.port=${port}`,
    ], {
      // dump stdout for quick debugging
      // stdio: "inherit",
    })

    // wait for server ready
    await expect.poll(() => fetch(pageUrl).then(res => res.status, e => e)).toBe(200)
  })

  test.afterAll(async () => {
    subProcess.kill()
    await subProcess.catch(() => {})
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
