import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { assertTestCounts, getExplorerItem, startHtmlReportPreview, startVitestUi } from './helper'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let pageUrl: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root: './fixtures/main',
      watch: true,
      ui: true,
      open: false,
      coverage: { enabled: true },
      reporters: [],
    })
    vitest = server.vitest
    pageUrl = `${server.url}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('basic', async ({ page }) => {
    await testBasic(page, pageUrl)
  })

  test('coverage', async ({ page }) => {
    await page.goto(pageUrl)
    await testCoverage(page)
  })

  test('console', async ({ page }) => {
    await page.goto(pageUrl)
    await testConsole(page)
  })

  test('error', async ({ page }) => {
    await page.goto(pageUrl)
    await testError(page)
  })

  test('filter', async ({ page }) => {
    await page.goto(pageUrl)
    await testFilter(page, { isStatic: false })
  })

  test('tags filter', async ({ page }) => {
    await page.goto(pageUrl)
    await testTagsFilter(page)
  })

  test('dashboard entries filter tests correctly', async ({ page }) => {
    await page.goto(pageUrl)
    await testDashboardFilter(page)
  })

  test('annotations in the report tab', async ({ page }) => {
    await page.goto(pageUrl)
    await testAnnotationsInReport(page)
  })

  test('annotations in the editor tab', async ({ page }) => {
    await page.goto(pageUrl)
    await testAnnotationsInCode(page)
  })

  test('visual regression in the report tab', async ({ page }) => {
    await page.goto(pageUrl)
    await testVisualRegression(page)
  })
})

test.describe('html report', () => {
  let previewServer: PreviewServer
  let pageUrl: string

  test.beforeAll(async () => {
    const server = await startHtmlReportPreview(
      {
        root: './fixtures/main',
        run: true,
        reporters: 'html',
        coverage: {
          enabled: true,
        },
      },
      {
        root: './fixtures/main',
        base: '/custom/base/',
        build: { outDir: 'html' },
      },
    )
    previewServer = server.previewServer
    pageUrl = `${server.url}/custom/base/`
  })

  test.afterAll(async () => {
    await previewServer?.close()
  })

  test('basic', async ({ page }) => {
    await testBasic(page, pageUrl)
  })

  test('coverage', async ({ page }) => {
    await page.goto(pageUrl)
    await testCoverage(page)
  })

  test('console', async ({ page }) => {
    await page.goto(pageUrl)
    await testConsole(page)
  })

  test('error', async ({ page }) => {
    await page.goto(pageUrl)
    await testError(page)
  })

  test('filter', async ({ page }) => {
    await page.goto(pageUrl)
    await testFilter(page, { isStatic: true })
  })

  test('tags filter', async ({ page }) => {
    await page.goto(pageUrl)
    await testTagsFilter(page)
  })

  test('dashboard entries filter tests correctly', async ({ page }) => {
    await page.goto(pageUrl)
    await testDashboardFilter(page)
  })

  test('annotations in the report tab', async ({ page }) => {
    await page.goto(pageUrl)
    await testAnnotationsInReport(page)
  })

  test('annotations in the editor tab', async ({ page }) => {
    await page.goto(pageUrl)
    await testAnnotationsInCode(page)
  })

  test('visual regression in the report tab', async ({ page }) => {
    await page.goto(pageUrl)
    await testVisualRegression(page)
  })
})

async function testBasic(page: Page, pageUrl: string) {
  const pageErrors: unknown[] = []
  page.on('pageerror', error => pageErrors.push(error))

  await page.goto(pageUrl)

  // dashboard
  await assertTestCounts(page, { pass: 17, fail: 3 })

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
}

async function testCoverage(page: Page) {
  await page.getByLabel('Show coverage').click()
  await page.frameLocator('#vitest-ui-coverage').getByRole('heading', { name: 'All files' }).click()
}

async function testAnnotationsInCode(page: Page) {
  const item = page.getByLabel('annotated.test.ts')
  await item.hover()
  await item.getByTestId('btn-open-details').click({ force: true })
  await page.getByTestId('btn-code').click({ force: true })

  const annotations = page.getByRole('note')
  await expect(annotations).toHaveCount(7)

  await expect(annotations.first()).toHaveText('notice: hello world')
  await expect(annotations.nth(1)).toHaveText('notice: second annotation')
  await expect(annotations.nth(2)).toHaveText('warning: beware!')
  await expect(annotations.nth(3)).toHaveText(/notice: file annotation/)
  await expect(annotations.nth(4)).toHaveText('notice: image annotation')
  await expect(annotations.nth(5)).toHaveText(/notice: body base64 annotation/)
  await expect(annotations.nth(6)).toHaveText(/notice: body utf-8 annotation/)

  // TODO: assertDownloadAttachment or assertValidImage
  await expect(annotations.nth(3).getByRole('link')).toHaveAttribute('href', /.+/)
  await expect(annotations.nth(4).getByRole('link')).toHaveAttribute('href', /.+/)
  await expect(annotations.nth(5).getByRole('link')).toHaveAttribute('href', /.+/)
  await expect(annotations.nth(6).getByRole('link')).toHaveAttribute('href', /.+/)
}

async function testAnnotationsInReport(page: Page) {
  await test.step('annotated test', async () => {
    const item = page.getByLabel('annotated test')
    await item.click({ force: true })
    await page.getByTestId('btn-report').click({ force: true })

    const annotations = page.getByRole('note')
    await expect(annotations).toHaveCount(2)

    await expect(annotations.first()).toContainText('hello world')
    await expect(annotations.first()).toContainText('notice')
    await expect(annotations.first()).toContainText('annotated.test.ts:4:9')

    await expect(annotations.last()).toContainText('second annotation')
    await expect(annotations.last()).toContainText('notice')
    await expect(annotations.last()).toContainText('annotated.test.ts:5:9')
  })

  await test.step('annotated typed test', async () => {
    const item = page.getByLabel('annotated typed test')
    await item.click({ force: true })
    await page.getByTestId('btn-report').click({ force: true })

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('beware!')
    await expect(annotation).toContainText('warning')
    await expect(annotation).toContainText('annotated.test.ts:9:9')
  })

  await test.step('annotated file test', async () => {
    const item = page.getByLabel('annotated file test')
    await item.click({ force: true })
    await page.getByTestId('btn-report').click({ force: true })

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('file annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:13:9')
    await expect(annotation.getByRole('link')).toHaveAttribute('href', /.+/)
  })

  await test.step('annotated image test', async () => {
    const item = page.getByLabel('annotated image test')
    await item.click({ force: true })
    await page.getByTestId('btn-report').click({ force: true })

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('image annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:19:9')
    await expect(annotation.getByRole('link')).toHaveAttribute('href', /.+/)
    await expect(annotation.getByRole('img')).not.toHaveJSProperty('naturalWidth', 0)
  })

  await test.step('annotated with body base64', async () => {
    const item = page.getByLabel('annotated with body base64')
    await item.click({ force: true })
    await page.getByTestId('btn-report').click({ force: true })

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('body base64 annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:25:9')

    const downloadPromise = page.waitForEvent('download')
    await annotation.getByRole('link').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('body-base64-annotation.md')
    const downloadPath = await download.path()
    const content = readFileSync(downloadPath, 'utf-8')
    expect(content).toBe('Hello base64 **markdown**')
  })

  await test.step('annotated with body utf-8', async () => {
    const item = page.getByLabel('annotated with body utf-8')
    await item.click({ force: true })
    await page.getByTestId('btn-report').click({ force: true })

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('body utf-8 annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:32:9')

    const downloadPromise = page.waitForEvent('download')
    await annotation.getByRole('link').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('body-utf-8-annotation.md')
    const downloadPath = await download.path()
    const content = readFileSync(downloadPath, 'utf-8')
    expect(content).toBe('Hello utf-8 **markdown**')
  })
}

async function testConsole(page: Page) {
  const item = page.getByLabel('console.test.ts')
  await item.hover()
  await item.getByTestId('btn-open-details').click({ force: true })
  await page.getByTestId('btn-console').click()
  await page.getByText('/(?<char>\\w)/').click()

  await expect(page.getByText('beforeAll')).toHaveCount(6)
  await expect(page.getByText('afterAll')).toHaveCount(6)
}

async function testError(page: Page) {
  const item = page.getByLabel('error.test.ts')
  await item.hover()
  await item.getByTestId('btn-open-details').click({ force: true })
  await expect(page.getByTestId('diff')).toContainText('- Expected + Received + <style>* {border: 2px solid green};</style>')

  await getExplorerItem(page, 'colored error message').click()
  await expect(page.getByTestId('report')).toHaveText('Error: this-is-blue - /node/error.test.ts:12:17')
}

async function testTagsFilter(page: Page) {
  await page.getByPlaceholder('Search...').fill('tag:db')

  // only one test with the tag "db"
  await expect(page.getByText('PASS (1)')).toBeVisible()
  await expect(page.getByTestId('explorer-item').filter({ hasText: 'has tags' })).toBeVisible()

  await page.getByPlaceholder('Search...').fill('tag:db && !flaky')
  await expect(page.getByText('No matched test')).toBeVisible()

  await page.getByPlaceholder('Search...').fill('tag:unknown')
  await expect(page.getByText('The tag pattern "unknown" is not defined in the configuration')).toBeVisible()
}

async function testVisualRegression(page: Page) {
  await getExplorerItem(page, 'visual regression test').click()

  const artifact = page.getByRole('note')
  await expect(artifact).toHaveCount(1)

  await expect(artifact.getByRole('heading')).toContainText('Visual Regression')
  await expect(artifact).toContainText('visual-regression.test.ts:13:3')
  await expect(artifact.getByRole('tablist')).toHaveText('Reference')
  await expect(artifact.getByRole('tabpanel').getByRole('img')).not.toHaveJSProperty('naturalWidth', 0)
}

async function testDashboardFilter(page: Page) {
  // Initial state should show all tests
  await expect(page.getByTestId('pass-entry')).toBeVisible()
  await expect(page.getByTestId('fail-entry')).toBeVisible()
  await expect(page.getByTestId('total-entry')).toBeVisible()

  // Click "Pass" entry and verify only passing tests are shown
  await page.getByTestId('pass-entry').click()
  await expect(page.getByLabel(/pass/i)).toBeChecked()

  // Click "Fail" entry and verify only failing tests are shown
  await page.getByTestId('fail-entry').click()
  await expect(page.getByLabel(/fail/i)).toBeChecked()

  // TODO: test skip
  // Click "Skip" entry if there are skipped tests
  if (await page.getByTestId('skipped-entry').isVisible()) {
    await page.getByTestId('skipped-entry').click()
    await expect(page.getByLabel(/skip/i)).toBeChecked()
  }

  // Click "Total" entry to reset filters and show all tests again
  await page.getByTestId('total-entry').click()
  await expect(page.getByLabel(/pass/i)).not.toBeChecked()
  await expect(page.getByLabel(/fail/i)).not.toBeChecked()
  await expect(page.getByLabel(/skip/i)).not.toBeChecked()
}

async function testFilter(page: Page, options: { isStatic: boolean }) {
  // match all files when no filter
  await page.getByPlaceholder('Search...').fill('')
  await page.getByText('PASS (6)').click()
  await expect(page.getByTestId('results-panel').getByText('sample.test.ts', { exact: true })).toBeVisible()

  // match nothing
  await page.getByPlaceholder('Search...').fill('nothing')
  await page.getByText('No matched test').click()

  // searching "add" will match "sample.test.ts" since it includes a test case named "add"
  await page.getByPlaceholder('Search...').fill('add')
  await page.getByText('PASS (1)').click()
  await expect(page.getByTestId('results-panel').getByText('sample.test.ts', { exact: true })).toBeVisible()

  // match only failing files when fail filter applied
  await page.getByPlaceholder('Search...').fill('')
  await page.getByText(/^Fail$/, { exact: true }).click()
  await page.getByText('FAIL (2)').click()
  await expect(page.getByTestId('results-panel').getByText('error.test.ts', { exact: true })).toBeVisible()
  await expect(page.getByTestId('results-panel').getByText('sample.test.ts', { exact: true })).toBeHidden()

  // match only pass files when fail filter applied
  await page.getByPlaceholder('Search...').fill('console')
  await page.getByText(/^Fail$/, { exact: true }).click()
  await page.locator('span').filter({ hasText: /^Pass$/ }).click()
  await page.getByText('PASS (1)').click()
  await expect(page.getByTestId('results-panel').getByText('console.test.ts', { exact: true })).toBeVisible()
  await expect(page.getByTestId('results-panel').getByText('sample.test.ts', { exact: true })).toBeHidden()

  // html entities in task names are escaped
  await page.locator('span').filter({ hasText: /^Pass$/ }).click()
  await page.getByPlaceholder('Search...').fill('<MyComponent />')
  // for some reason, the tree is collapsed by default: we need to click on the nav buttons to expand it
  await page.getByTestId('collapse-all').click()
  await page.getByTestId('expand-all').click()
  await expect(page.getByText('<MyComponent />')).toBeVisible()
  await expect(page.getByTestId('results-panel').getByText('task-name.test.ts', { exact: true })).toBeVisible()

  // html entities in task names are escaped
  await page.getByPlaceholder('Search...').fill('<>\'"')
  await expect(page.getByText('<>\'"')).toBeVisible()
  await expect(page.getByTestId('results-panel').getByText('task-name.test.ts', { exact: true })).toBeVisible()

  // pass files with special chars
  await page.getByPlaceholder('Search...').fill('char () - Square root of nine (9)')
  const testItem = getExplorerItem(page, 'char () - Square root of nine (9)')
  await expect(testItem).toBeVisible()
  if (!options.isStatic) {
    await testItem.hover()
    await testItem.getByLabel('Run current test').click()
    await expect(page.getByText('The test has passed without any errors')).toBeVisible()
  }
}

test.describe('standalone', () => {
  let vitest: Vitest | undefined
  let pageUrl: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root: './fixtures/main',
      watch: true,
      ui: true,
      standalone: true,
      open: false,
      reporters: [],
    })
    vitest = server.vitest
    pageUrl = `${server.url}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('basic', async ({ page }) => {
    await page.goto(pageUrl)

    // initially no stats
    await assertTestCounts(page, { pass: 0, fail: 0 })

    // run single file
    await getExplorerItem(page, 'sample.test.ts').hover()
    await page.getByRole('button', { name: 'Run current file' }).click()

    // check results
    await page.getByRole('button', { name: 'Show dashboard' }).click()
    await assertTestCounts(page, { pass: 2, fail: 0 })
    expect(vitest?.state.getFiles().map(f => [f.name, f.result?.state])).toEqual([
      ['sample.test.ts', 'pass'],
    ])
  })
})
