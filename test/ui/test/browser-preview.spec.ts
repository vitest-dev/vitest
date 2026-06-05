import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { startVitest } from 'vitest/node'
import { assertTestCounts } from './helper'

test.describe('orchestrator UI on preview provider', () => {
  test('basic', async ({ page }) => {
    globalThis.__hackOpenBrowser = async (url: string) => {
      await page.goto(url)
    }
    const vitest = await startVitest(
      undefined,
      {
        root: './fixtures/browser-preview',
        watch: true,
      },
      undefined,
      {
        stdout: new Writable({ write: (_, __, callback) => callback() }),
        stderr: new Writable({ write: (_, __, callback) => callback() }),
      },
    )

    // results in dashboard
    await assertTestCounts(page, { pass: 1, fail: 0 })

    // test code runs in tester iframe
    const testerFrame = page.frameLocator('iframe[data-vitest="true"]')
    await expect(testerFrame.getByRole('button')).toHaveText('hello')

    await vitest.close()
  })
})
