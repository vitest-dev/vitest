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
  await expect(failures).toContainText('expected [ 3, 5, 6 ] to have a length of 4 but got 3')
  await expect(details.locator('dt')).toHaveText(['Failed', 'Seeds', 'Reproduced', 'Replay'])
  await expect(details.locator('dd code')).toHaveText([
    'repeats 1-4, 6-8',
    '66ee55163d94fe1d (this error), 82881667d3a1de27, 7ce4ef1457e17d84 and 4 more',
    '7 of 7 seeds',
    replayCommand('sort.test.ts', 'keeps every number', '66ee55163d94fe1d'),
  ])
  await expect(details.getByRole('button', { name: 'Copy the replay command' })).toBeVisible()

  // the replay of the seed fails with another error, so it has its own error and a warning
  await openExplorerItem(page, 'the first user gets the id 1')
  await expect(failures).toHaveCount(2)
  await expect(failures.nth(0)).toContainText('expected 2 to be 1')
  await expect(failures.nth(1)).toContainText('expected 3 to be 1')
  await expect(details.nth(0).locator('dd code')).toHaveText([
    '1st repeat',
    'f4fa24ace2057ecd',
    '1 of 2 runs: the test depends on more than its seed',
    replayCommand('users.test.ts', 'the first user gets the id 1', 'f4fa24ace2057ecd'),
  ])
  await expect(details.nth(1).locator('dd code').first()).toHaveText('replay of 1st repeat')
}
