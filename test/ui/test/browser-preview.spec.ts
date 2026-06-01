import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { startVitest } from 'vitest/node'
import { assertTestCounts } from './helper'

test.describe('browser preview provider', () => {
  test('basic', async ({ page }) => {
    globalThis.__hackOpenBrowser = async (url: string) => {
      await page.goto(url)
    }
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })
    const vitest = await startVitest(
      undefined,
      {
        root: './fixtures/browser-preview',
        watch: true,
        reporters: [],
      },
      {},
      { stdout, stderr },
    )
    await assertTestCounts(page, { pass: 1, fail: 0 })

    const testerFrame = page.frameLocator('iframe[data-vitest="true"]')
    await expect(testerFrame.getByRole('button')).toHaveText('hello')

    await vitest.close()
  })
})
