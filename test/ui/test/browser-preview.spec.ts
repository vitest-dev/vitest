import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { startVitest } from 'vitest/node'
import { assertTestCounts } from './helper'

test.describe('orchestrator UI on preview provider', () => {
  test('basic', async ({ page }) => {
    let previewUrl: string | undefined
    globalThis.__hackOpenBrowser = async (url: string) => {
      previewUrl = url
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

    // valid `sessionId` is required for orchestrator UI
    expect(new URL(previewUrl!).searchParams.get('sessionId')).toBeDefined()
    const res1 = await page.request.get(new URL('/__vitest_test__/', previewUrl!).toString())
    expect(res1.status()).toBe(404)
    expect(await res1.text()).toBe('Not found')
    const res2 = await page.request.get(new URL('/__vitest_test__/?sessionId=invalid', previewUrl!).toString())
    expect(res2.status()).toBe(404)
    expect(await res2.text()).toBe('Not found')

    // results in dashboard
    await assertTestCounts(page, { pass: 1, fail: 0 })

    // test code runs in tester iframe
    const testerFrame = page.frameLocator('iframe[data-vitest="true"]')
    await expect(testerFrame.getByRole('button')).toHaveText('hello')

    await vitest.close()
  })
})
