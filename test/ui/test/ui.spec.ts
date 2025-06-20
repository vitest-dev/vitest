import type { Vitest } from 'vitest/node'
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
  })

  test('annotations in the editor tab', async ({ page }) => {
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

    await expect(annotations.last().getByRole('link')).toHaveAttribute('href', /__vitest_attachment__\?path=/)
    await expect(annotations.nth(3).getByRole('link')).toHaveAttribute('href', /__vitest_attachment__\?path=/)
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
    await page.getByText('PASS (5)').click()
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

    // pass files with special chars
    await page.getByPlaceholder('Search...').fill('char () - Square root of nine (9)')
    await expect(page.getByText('char () - Square root of nine (9)')).toBeVisible()
    await page.getByText('char () - Square root of nine (9)').hover()
    await page.getByLabel('Run current test').click()
    await expect(page.getByText('All tests passed in this file')).toBeVisible()
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
