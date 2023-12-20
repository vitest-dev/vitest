import { expect, test } from '@playwright/test'
import { type Vitest, startVitest } from 'vitest/node'

const port = 9000
const pageUrl = `http://localhost:${port}/__vitest__/`

test.describe('ui', () => {
  let vitest: Vitest | undefined

  test.beforeAll(async () => {
    vitest = await startVitest('test', [], { watch: true, ui: true, open: false, api: { port }, coverage: { enabled: true } })
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
    await expect(page.locator('[aria-labelledby=tests]')).toContainText('5 Pass 0 Fail 5 Total')

    // unhandled errors
    await expect(page.getByTestId('unhandled-errors')).toContainText(
      'Vitest caught 2 errors during the test run. This might cause false positive tests. '
      + 'Resolve unhandled errors to make sure your tests are not affected.',
    )

    await expect(page.getByTestId('unhandled-errors-details')).toContainText('Error: error')
    await expect(page.getByTestId('unhandled-errors-details')).toContainText('Unknown Error: 1')

    // report
    await page.getByTestId('details-panel').getByText('sample.test.ts').click()
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

  test('coverage', async ({ page }) => {
    await page.goto(pageUrl)
    await page.getByLabel('Show coverage').click()
    await page.frameLocator('#vitest-ui-coverage').getByRole('heading', { name: 'All files' }).click()
  })

  test('console', async ({ page }) => {
    await page.goto(pageUrl)
    await page.getByText('fixtures/console.test.ts').click()
    await page.getByTestId('btn-console').click()
    await page.getByText('/(?<char>\\w)/').click()
  })

  test('file-filter', async ({ page }) => {
    await page.goto(pageUrl)

    // match all files when no filter
    await page.getByPlaceholder('Search...').fill('')
    await page.getByText('PASS (3)').click()
    await expect(page.getByTestId('details-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()

    // match nothing
    await page.getByPlaceholder('Search...').fill('nothing')
    await page.getByText('No matched test').click()

    // searching "add" will match "sample.test.ts" since it includes a test case named "add"
    await page.getByPlaceholder('Search...').fill('add')
    await page.getByText('PASS (1)').click()
    await expect(page.getByTestId('details-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()
  })
})
