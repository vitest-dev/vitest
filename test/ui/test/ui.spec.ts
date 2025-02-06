import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { startVitest, type Vitest } from 'vitest/node'

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
      coverage: { enabled: true, reporter: ['html'] },
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

  test('security', async ({ page }) => {
    await page.goto('https://example.com/')

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
    await page.getByText('PASS (4)').click()
    await expect(page.getByTestId('details-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()

    // match nothing
    await page.getByPlaceholder('Search...').fill('nothing')
    await page.getByText('No matched test').click()

    // searching "add" will match "sample.test.ts" since it includes a test case named "add"
    await page.getByPlaceholder('Search...').fill('add')
    await page.getByText('PASS (1)').click()
    await expect(page.getByTestId('details-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeVisible()

    // match only failing files when fail filter applied
    await page.getByPlaceholder('Search...').fill('')
    await page.getByText(/^Fail$/, { exact: true }).click()
    await page.getByText('FAIL (1)').click()
    await expect(page.getByTestId('details-panel').getByText('fixtures/error.test.ts', { exact: true })).toBeVisible()
    await expect(page.getByTestId('details-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeHidden()

    // match only pass files when fail filter applied
    await page.getByPlaceholder('Search...').fill('console')
    await page.getByText(/^Fail$/, { exact: true }).click()
    await page.locator('span').filter({ hasText: /^Pass$/ }).click()
    await page.getByText('PASS (1)').click()
    await expect(page.getByTestId('details-panel').getByText('fixtures/console.test.ts', { exact: true })).toBeVisible()
    await expect(page.getByTestId('details-panel').getByText('fixtures/sample.test.ts', { exact: true })).toBeHidden()

    // html entities in task names are escaped
    await page.locator('span').filter({ hasText: /^Pass$/ }).click()
    await page.getByPlaceholder('Search...').fill('<MyComponent />')
    // for some reason, the tree is collapsed by default: we need to click on the nav buttons to expand it
    await page.getByTestId('collapse-all').click()
    await page.getByTestId('expand-all').click()
    await expect(page.getByText('<MyComponent />')).toBeVisible()
    await expect(page.getByTestId('details-panel').getByText('fixtures/task-name.test.ts', { exact: true })).toBeVisible()

    // html entities in task names are escaped
    await page.getByPlaceholder('Search...').fill('<>\'"')
    await expect(page.getByText('<>\'"')).toBeVisible()
    await expect(page.getByTestId('details-panel').getByText('fixtures/task-name.test.ts', { exact: true })).toBeVisible()
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
