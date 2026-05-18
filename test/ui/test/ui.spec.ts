import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { expect, test } from '@playwright/test'
import { assertDownloadAttachment, assertImageAttachment, assertTestCounts, getExplorerItem, openExplorerFileItem, startHtmlReportPreview, startVitestUi } from './helper'

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

  test('cross origin access', async ({ page }) => {
    await testCrossOriginAccess(page, pageUrl)
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
    await testFilter(page, { mode: 'ui' })
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

  test('can edit file', async ({ page }) => {
    await page.goto(pageUrl)
    await testWriteFile(page, { enabled: true })
  })

  test('can execute', async ({ page }) => {
    await page.goto(pageUrl)
    await testExecute(page, { mode: 'ui' })
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
    await testFilter(page, { mode: 'static' })
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

  test('cannot edit file', async ({ page }) => {
    await page.goto(pageUrl)
    await testWriteFile(page, { enabled: false })
  })

  test('cannot execute', async ({ page }) => {
    await page.goto(pageUrl)
    await testExecute(page, { mode: 'static' })
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
  await openExplorerFileItem(page, 'sample.test.ts')
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

async function testAnnotationsInReport(page: Page) {
  await test.step('annotated test', async () => {
    await getExplorerItem(page, 'annotated test').click()

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
    await getExplorerItem(page, 'annotated typed test').click()

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('beware!')
    await expect(annotation).toContainText('warning')
    await expect(annotation).toContainText('annotated.test.ts:9:9')
  })

  await test.step('annotated file test', async () => {
    await getExplorerItem(page, 'annotated file test').click()

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('file annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:13:9')
    await assertDownloadAttachment(page, {
      name: 'file annotation',
      suggestedFilename: 'file-annotation.txt',
      content: 'hello world\n',
    })
  })

  await test.step('annotated image test', async () => {
    await getExplorerItem(page, 'annotated image test').click()

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('image annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:19:9')
    await assertImageAttachment(page, {
      name: 'image annotation',
    })
  })

  await test.step('annotated with body base64', async () => {
    await getExplorerItem(page, 'annotated with body base64').click()

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('body base64 annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:25:9')
    await assertDownloadAttachment(page, {
      name: 'body base64 annotation',
      suggestedFilename: 'body-base64-annotation.md',
      content: 'Hello base64 **markdown**',
    })
  })

  await test.step('annotated with body utf-8', async () => {
    await getExplorerItem(page, 'annotated with body utf-8').click()

    const annotation = page.getByRole('note')
    await expect(annotation).toHaveCount(1)

    await expect(annotation).toContainText('body utf-8 annotation')
    await expect(annotation).toContainText('notice')
    await expect(annotation).toContainText('annotated.test.ts:32:9')
    await assertDownloadAttachment(page, {
      name: 'body utf-8 annotation',
      suggestedFilename: 'body-utf-8-annotation.md',
      content: 'Hello utf-8 **markdown**',
    })
  })
}

async function testAnnotationsInCode(page: Page) {
  await openExplorerFileItem(page, 'annotated.test.ts')
  await page.getByTestId('btn-code').click()

  const annotations = page.getByRole('note')
  await expect(annotations).toHaveCount(7)

  await expect(annotations.first()).toHaveText('notice: hello world')
  await expect(annotations.nth(1)).toHaveText('notice: second annotation')
  await expect(annotations.nth(2)).toHaveText('warning: beware!')
  await expect(annotations.nth(3)).toHaveText(/notice: file annotation/)
  await expect(annotations.nth(4)).toHaveText('notice: image annotation')
  await expect(annotations.nth(5)).toHaveText(/notice: body base64 annotation/)
  await expect(annotations.nth(6)).toHaveText(/notice: body utf-8 annotation/)

  await assertDownloadAttachment(page, {
    name: 'file annotation',
    suggestedFilename: 'file-annotation.txt',
    content: 'hello world\n',
  })
  await assertDownloadAttachment(page, {
    name: 'body base64 annotation',
    suggestedFilename: 'body-base64-annotation.md',
    content: 'Hello base64 **markdown**',
  })
  await assertDownloadAttachment(page, {
    name: 'body utf-8 annotation',
    suggestedFilename: 'body-utf-8-annotation.md',
    content: 'Hello utf-8 **markdown**',
  })
  await assertImageAttachment(page, {
    name: 'image annotation',
  })
}

async function testConsole(page: Page) {
  await openExplorerFileItem(page, 'console.test.ts')
  await page.getByTestId('btn-console').click()
  await page.getByText('/(?<char>\\w)/').click()

  await expect(page.getByText('beforeAll')).toHaveCount(6)
  await expect(page.getByText('afterAll')).toHaveCount(6)
}

async function testError(page: Page) {
  await openExplorerFileItem(page, 'error.test.ts')
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
  await expect(artifact).toContainText('visual-regression.test.ts:7:3')
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

async function testFilter(page: Page, options: { mode: 'ui' | 'static' }) {
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
  if (options.mode === 'ui') {
    await testItem.hover()
    await testItem.getByLabel('Run current test').click()
    await expect(page.getByText('The test has passed without any errors')).toBeVisible()
  }
}

async function testCrossOriginAccess(page: Page, pageUrl: string) {
  await page.route('https://example.com/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>Faked Cross Origin Site</h1></body></html>',
    })
  })
  await page.goto('https://example.com/', { timeout: 5000 })

  // request html
  const htmlResult = await page.evaluate(async (pageUrl) => {
    try {
      const res = await fetch(pageUrl)
      return res.status
    }
    catch (e) {
      return e instanceof Error ? e.message : e
    }
  }, pageUrl)
  expect(htmlResult).toBe('Failed to fetch')

  // request websocket
  const wsResult = await page.evaluate(async (pageUrl) => {
    const ws = new WebSocket(new URL('/__vitest_api__', pageUrl))
    return new Promise((resolve) => {
      ws.addEventListener('open', () => {
        resolve('open')
      })
      ws.addEventListener('error', () => {
        resolve('error')
      })
    })
  }, pageUrl)
  expect(wsResult).toBe('error')
}

async function testWriteFile(page: Page, options: { enabled: boolean }) {
  await getExplorerItem(page, 'add').click()
  const codeTabButton = page.getByTestId('btn-code')
  await expect(codeTabButton).toHaveText('Code')
  await codeTabButton.click()
  const editor = page.getByTestId('editor')
  await expect(editor).toContainText('expect(1 + 1).toEqual(2)')
  await page.keyboard.type('\n// edited \n')
  if (options.enabled) {
    await expect(editor).toContainText('// edited')
  }
  else {
    await expect(editor).not.toContainText('// edited')
  }
}

async function testExecute(page: Page, options: { mode: 'ui' | 'ui-disallow' | 'static' }) {
  if (options.mode === 'ui') {
    await expect(page.getByTestId('btn-run-all')).toBeEnabled()

    const item = getExplorerItem(page, 'add')
    await item.hover()
    await expect(item.getByTestId('btn-run-test')).toBeEnabled()

    await page.getByPlaceholder('Search...').fill('snapshot')
    const snapshotItem = getExplorerItem(page, 'snapshot.test.ts')
    await snapshotItem.hover()
    await expect(snapshotItem.getByTestId('btn-fix-snapshot')).toBeVisible()
  }
  if (options.mode === 'ui-disallow') {
    await expect(page.getByTestId('btn-run-all')).toBeDisabled()

    const item = getExplorerItem(page, 'add')
    await item.hover()
    await expect(item.getByTestId('btn-run-test')).toBeDisabled()

    await page.getByPlaceholder('Search...').fill('snapshot')
    const snapshotItem = getExplorerItem(page, 'snapshot.test.ts')
    await snapshotItem.hover()
    await expect(snapshotItem.getByTestId('btn-fix-snapshot')).not.toBeVisible()
  }
  if (options.mode === 'static') {
    await expect(page.getByTestId('btn-run-all')).not.toBeVisible()

    const item = getExplorerItem(page, 'add')
    await item.hover()
    await expect(item.getByTestId('btn-run-test')).not.toBeVisible()

    await page.getByPlaceholder('Search...').fill('snapshot')
    const snapshotItem = getExplorerItem(page, 'snapshot.test.ts')
    await snapshotItem.hover()
    await expect(snapshotItem.getByTestId('btn-fix-snapshot')).not.toBeVisible()
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

test.describe('security', () => {
  let vitest: Vitest | undefined
  let pageUrl: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root: './fixtures/main',
      watch: true,
      ui: true,
      open: false,
      api: {
        allowExec: false,
        allowWrite: false,
      },
      reporters: [],
    })
    vitest = server.vitest
    pageUrl = `${server.url}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('cannot write file', async ({ page }) => {
    await page.goto(pageUrl)
    await testWriteFile(page, { enabled: false })
  })

  test('cannot execute', async ({ page }) => {
    await page.goto(pageUrl)
    await testExecute(page, { mode: 'ui-disallow' })
  })
})
