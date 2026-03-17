import type { Vitest } from 'vitest/node'
import { readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { startVitest } from 'vitest/node'

const port = 9000
const pageUrl = `http://localhost:${port}/__vitest__/`

test.describe('ui', () => {
  let vitest: Vitest | undefined

  test.beforeAll(async () => {
    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    vitest = await startVitest('test', [], {
      watch: true,
      ui: true,
      open: false,
      api: { port },
      coverage: { enabled: true },
      reporters: [],
    }, {}, {
      stdout,
      stderr,
    })
    expect(vitest).toBeDefined()
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('security', async ({ page }, testInfo) => {
    const response = await page.goto('https://example.com/', { timeout: 5000 }).catch(() => null)

    testInfo.skip(!response, 'External resource is not available')

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

  test('console', async ({ page }) => {
    await page.goto(pageUrl)
    const item = page.getByLabel('fixtures/console.test.ts')
    await item.hover()
    await item.getByTestId('btn-open-details').click({ force: true })
    await page.getByTestId('btn-console').click()
    await page.getByText('/(?<char>\\w)/').click()

    expect(await page.getByText('beforeAll').all()).toHaveLength(6)
    expect(await page.getByText('afterAll').all()).toHaveLength(6)
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
      await expect(annotation.getByRole('link')).toHaveAttribute('href', /__vitest_attachment__\?path=/)
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
      await expect(annotation.getByRole('link')).toHaveAttribute('href', /__vitest_attachment__\?path=/)
      await expect(annotation.getByRole('img')).toHaveAttribute('src', /__vitest_attachment__\?path=/)
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

  test('annotations in the editor tab', async ({ page }) => {
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

    await expect(annotations.nth(3).getByRole('link')).toHaveAttribute('href', /__vitest_attachment__\?path=/)
    await expect(annotations.nth(4).getByRole('link')).toHaveAttribute('href', /__vitest_attachment__\?path=/)
    await expect(annotations.nth(5).getByRole('link')).toHaveAttribute('href', /^data:text\/markdown;base64,/)
  })

  test('error', async ({ page }) => {
    await page.goto(pageUrl)
    const item = page.getByLabel('fixtures/error.test.ts')
    await item.hover()
    await item.getByTestId('btn-open-details').click({ force: true })
    await expect(page.getByTestId('diff')).toContainText('- Expected + Received + <style>* {border: 2px solid green};</style>')
  })

  test('file-filter', async ({ page }) => {
    await page.goto(pageUrl)

    // match all files when no filter
    await page.getByPlaceholder('Search...').fill('')
    await page.getByText('PASS (6)').click()
    await expect(page.getByTestId('results-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()

    // match nothing
    await page.getByPlaceholder('Search...').fill('nothing')
    await page.getByText('No matched test').click()

    // searching "add" will match "sample.test.ts" since it includes a test case named "add"
    await page.getByPlaceholder('Search...').fill('add')
    await page.getByText('PASS (1)').click()
    await expect(page.getByTestId('results-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()

    // match only failing files when fail filter applied
    await page.getByPlaceholder('Search...').fill('')
    await page.getByText(/^Fail$/, { exact: true }).click()
    await page.getByText('FAIL (2)').click()
    await expect(page.getByTestId('results-panel').getByText('fixtures/error.test.ts', { exact: true })).toBeVisible()
    await expect(page.getByTestId('results-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeHidden()

    // match only pass files when fail filter applied
    await page.getByPlaceholder('Search...').fill('console')
    await page.getByText(/^Fail$/, { exact: true }).click()
    await page.locator('span').filter({ hasText: /^Pass$/ }).click()
    await page.getByText('PASS (1)').click()
    await expect(page.getByTestId('results-panel').getByText('fixtures/console.test.ts', { exact: true })).toBeVisible()
    await expect(page.getByTestId('results-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeHidden()

    // html entities in task names are escaped
    await page.locator('span').filter({ hasText: /^Pass$/ }).click()
    await page.getByPlaceholder('Search...').fill('<MyComponent />')
    // for some reason, the tree is collapsed by default: we need to click on the nav buttons to expand it
    await page.getByTestId('collapse-all').click()
    await page.getByTestId('expand-all').click()
    await expect(page.getByText('<MyComponent />')).toBeVisible()
    await expect(page.getByTestId('results-panel').getByText('fixtures/task-name.test.ts', { exact: true })).toBeVisible()

    // html entities in task names are escaped
    await page.getByPlaceholder('Search...').fill('<>\'"')
    await expect(page.getByText('<>\'"')).toBeVisible()
    await expect(page.getByTestId('results-panel').getByText('fixtures/task-name.test.ts', { exact: true })).toBeVisible()

    // pass files with special chars
    await page.getByPlaceholder('Search...').fill('char () - Square root of nine (9)')
    await expect(page.getByText('char () - Square root of nine (9)')).toBeVisible()
    const testItem = page.getByTestId('explorer-item').filter({ hasText: 'char () - Square root of nine (9)' })
    await testItem.hover()
    await testItem.getByLabel('Run current test').click()
    await expect(page.getByText('The test has passed without any errors')).toBeVisible()
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

  test('dashboard entries filter tests correctly', async ({ page }) => {
    await page.goto(pageUrl)

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
      await expect(artifact.getByRole('tabpanel').getByRole('link')).toHaveAttribute('href', /__vitest_attachment__\?path=.*?\.png/)
      await expect(artifact.getByRole('tabpanel').getByRole('img')).toHaveAttribute('src', /__vitest_attachment__\?path=.*?\.png/)
    })
  })
})

test.describe('standalone', () => {
  let vitest: Vitest | undefined

  test.beforeAll(async () => {
    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    vitest = await startVitest('test', [], {
      watch: true,
      ui: true,
      standalone: true,
      open: false,
      api: { port },
      reporters: [],
    }, {}, {
      stdout,
      stderr,
    })
    expect(vitest).toBeDefined()
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('basic', async ({ page }) => {
    await page.goto(pageUrl)

    // initially no stats
    await expect(page.locator('[aria-labelledby=tests]')).toContainText('0 Pass 0 Fail 0 Total')

    // run single file
    await page.getByText('fixtures/sample.test.ts').hover()
    await page.getByRole('button', { name: 'Run current file' }).click()

    // check results
    await page.getByText('PASS (1)').click()
    expect(vitest?.state.getFiles().map(f => [f.name, f.result?.state])).toEqual([
      ['fixtures/sample.test.ts', 'pass'],
    ])
  })
})
