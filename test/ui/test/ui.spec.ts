import { expect, test } from '@playwright/test'
import { type Vitest, startVitest } from 'vitest/node'

const port = 9000
const pageUrl = `http://localhost:${port}/__vitest__/`

test.describe('ui', () => {
  let vitest: Vitest | undefined

  test.beforeAll(async () => {
    vitest = await startVitest('test', [], { watch: true, ui: true, open: false, api: { port } })
    expect(vitest).toBeDefined()
  })

  test.afterAll(async () => {
    await vitest?.close()
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

  test('file-filter', async ({ page }) => {
    await page.goto(pageUrl)

    await page.getByPlaceholder('Search...').fill('')
    await page.getByText('PASS (1)').click()
    await expect(page.getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()

    await page.getByPlaceholder('Search...').fill('nothing')
    await page.getByText('No matched test').click()

    await page.getByPlaceholder('Search...').fill('add')
    await page.getByText('PASS (1)').click()
    await expect(page.getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()
  })
})
