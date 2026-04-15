import type { Vitest } from 'vitest/node'
import assert from 'node:assert'
import { expect, test } from '@playwright/test'
import { startVitest } from 'vitest/node'

// TODO: reuse same test cases for HTML reporter + preview
test.describe('ui', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  test.beforeAll(async () => {
    vitest = await startVitest(
      'test',
      undefined,
      {
        root: './fixtures-trace',
        watch: true,
        ui: true,
        open: false,
        reporters: [
          {
            // reporter to surface minimal vitest side info
            onTestRunStart() {
              // eslint-disable-next-line no-console
              console.log('[fixtures-trace:onTestRunStart]')
            },
            onTestRunEnd(testModules, unhandledErrors, reason) {
              // eslint-disable-next-line no-console
              console.log('[fixtures-trace:onTestRunEnd]', {
                testModules: testModules.length,
                unhandledErrors: unhandledErrors.length,
                reason,
              })
            },
          },
        ],
      },
    )
    const address = vitest.vite.httpServer?.address()
    assert(address && typeof address === 'object', 'Invalid server address')
    baseURL = `http://localhost:${address.port}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
  })

  test('basic', async ({ page }) => {
    await page.goto(baseURL)
    await expect(page.getByTestId('tests-entry')).toContainText('11 Pass 2 Fail 13 Total')
  })
})
