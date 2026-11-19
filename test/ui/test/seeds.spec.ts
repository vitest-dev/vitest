import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import { expect } from '@playwright/test'
import {
  assertTestCounts,
  openExplorerItem,
  startHtmlReportPreview,
  startVitestUi,
  test,
} from './helper'

const root = './fixtures/seeds'

test.describe('ui', () => {
  let vitest: Vitest | undefined
  let pageUrl: string

  test.beforeAll(async () => {
    const server = await startVitestUi({
      root,
      watch: true,
      ui: true,
      open: false,
      reporters: [],
    })
    vitest = server.vitest
    pageUrl = server.url
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('failed seeds', async ({ page }) => {
    await page.goto(pageUrl)
    await testFailedSeeds(page)
  })
})

test.describe('html report', () => {
  let previewServer: PreviewServer
  let pageUrl: string

  test.beforeAll(async () => {
    const server = await startHtmlReportPreview(
      { root, run: true, reporters: 'html' },
      { root, build: { outDir: '.vitest' } },
    )
    previewServer = server.previewServer
    pageUrl = `${server.url}/`
  })

  test.afterAll(async () => {
    await previewServer?.close()
  })

  test('failed seeds', async ({ page }) => {
    await page.goto(pageUrl)
    await testFailedSeeds(page)
  })
})

// on Windows, the replay command quotes arguments for PowerShell
function replayCommand(file: string, testName: string, seed: string) {
  const pattern = process.platform === 'win32' ? `"^${testName}\`$"` : `'^${testName}$'`
  return `vitest run ${file} -t ${pattern} --seed 7 --replay-seed ${seed}`
}

async function testFailedSeeds(page: Page) {
  await assertTestCounts(page, { pass: 0, fail: 2 })
  await expect(page.getByTestId('run-seed')).toHaveText('7')

  const report = page.getByTestId('report')
  const failures = report.getByTestId('test-failure')
  const details = report.getByTestId('failure-details')

  // the seeds that fail at the same place share 1 error and 1 replay command
  await openExplorerItem(page, 'keeps every number')
  await expect(failures).toHaveCount(1)
  await expect(failures).toContainText('expected [ 2, 4, 6 ] to have a length of 4 but got 3')
  await expect(details.locator('dt')).toHaveText(['Failed', 'Runs', 'Seeds', 'Replay'])
  await expect(details.locator('dd code')).toHaveText([
    '5 of 10 runs',
    'initial run, repeats 2-3, 6, 8',
    'ae92b47cfa1959b9, 82881667d3a1de27, 7ce4ef1457e17d84, 105f78f9d604de83, 0b69ccc769a1eba5',
    replayCommand('sort.test.ts', 'keeps every number', 'ae92b47cfa1959b9'),
  ])
  await expect(details.getByRole('button', { name: 'Copy the replay command' })).toBeVisible()

  // the replay of the seed fails with another error, so the details have a warning with it
  await openExplorerItem(page, 'the first user gets the id 1')
  await expect(failures).toHaveCount(1)
  await expect(failures).toContainText('expected 2 to be 1')
  await expect(details.locator('dt')).toHaveText(['Failed', 'Runs', 'Seed', 'Reproduced', 'Replay'])
  await expect(details.locator('dd code')).toHaveText([
    '1 of 2 runs',
    '1st repeat',
    'f4fa24ace2057ecd',
    'no, the 2nd run failed with another error, so the test depends on more than its seed\nAssertionError: expected 3 to be 1 // Object.is equality',
    replayCommand('users.test.ts', 'the first user gets the id 1', 'f4fa24ace2057ecd'),
  ])
}
