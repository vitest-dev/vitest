import type { Page } from '@playwright/test'
import type { Vitest } from 'vitest/node'
import assert from 'node:assert'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Writable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { resolve } from 'pathe'
import { startVitest } from 'vitest/node'

// TODO:
// - trace range (action, expect.element, functional mark)

test.describe('trace stream', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  const root = path.join(import.meta.dirname, '../fixtures-trace-stream')
  const gatesDir = path.join(root, 'node_modules/.vitest-e2e')

  test.beforeAll(async () => {
    await rm(gatesDir, { recursive: true, force: true })
    await mkdir(gatesDir, { recursive: true })

    // silence Vitest logs
    const stdout = new Writable({ write: (_, __, callback) => callback() })
    const stderr = new Writable({ write: (_, __, callback) => callback() })

    // start standalone to hold off running tests
    vitest = await startVitest(
      'test',
      undefined,
      {
        root,
        watch: true,
        ui: true,
        open: false,
        standalone: true,
      },
      {
        define: {
          'import.meta.env.TEST_GATE_FILE': 'true',
        },
      },
      { stdout, stderr },
    )
    const address = vitest.vite.httpServer?.address()
    assert(address && typeof address === 'object', 'Invalid server address')
    baseURL = `http://localhost:${address.port}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
    await rm(gatesDir, { recursive: true, force: true })
  })

  test('basic', async ({ page }) => {
    await page.goto(baseURL)

    const runPromise = vitest!.runTestSpecifications(
      await vitest!.globTestSpecifications(),
    )

    const testItem = getExplorerItem(page, 'simple')
    await expect(testItem).toBeVisible()

    // click test case in explore to open trace view
    const traceView = page.getByTestId('trace-view')
    await expect(traceView).not.toBeVisible()
    await testItem.click()
    await expect(traceView).toBeVisible()

    // partially recorded traces up-to `render-a`
    const traceSteps = traceView.getByTestId('trace-step-name')
    await expect.poll(() => traceSteps.allInnerTexts()).toEqual([
      'render-a',
    ])

    // continue test and record more traces up-to `render-b`
    await writeFile(resolve(gatesDir, 'b.txt'), 'open')
    await expect.poll(() => traceSteps.allInnerTexts()).toEqual([
      'render-a',
      'render-b',
    ])

    // continue test and record more traces up-to `render-c` and test finishes
    await writeFile(resolve(gatesDir, 'c.txt'), 'open')
    await expect.poll(() => traceSteps.allInnerTexts()).toEqual([
      'render-a',
      'render-b',
      'render-c',
      'test finished',
    ])
    await runPromise

    // re-run and verify trace view is cleared
    await rm(gatesDir, { recursive: true, force: true })
    await mkdir(gatesDir, { recursive: true })
    const rerunPromise = vitest!.runTestSpecifications(
      await vitest!.globTestSpecifications(),
    )
    await expect.poll(() => traceSteps.allInnerTexts()).toEqual([
      'render-a',
    ])
    await writeFile(resolve(gatesDir, 'b.txt'), 'open')
    await writeFile(resolve(gatesDir, 'c.txt'), 'open')
    await expect.poll(() => traceSteps.allInnerTexts()).toEqual([
      'render-a',
      'render-b',
      'render-c',
      'test finished',
    ])
    await rerunPromise
  })
})

function getExplorerItem(page: Page, name: string) {
  return page.getByTestId('explorer-item').and(page.getByLabel(name, { exact: true }))
}
